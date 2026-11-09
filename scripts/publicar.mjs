// Fluxo "Git + Supabase + Vercel": os PDFs e capas ficam em catalogos/ (versionados no Git e servidos
// pela Vercel) e a lista do site fica na tabela public.catalogos do Supabase.
//
//   node scripts/publicar.mjs importar <url-do-site> [slug,slug]
//       Baixa para catalogos/ os catálogos enviados pelo painel (produção ou prévia local) e
//       atualiza catalogos/catalogos.json. Sem slugs, importa todos que ainda não estão em catalogos/.
//   node scripts/publicar.mjs banco
//       Grava no Supabase (DATABASE_URL) o que está em catalogos/catalogos.json. Rode DEPOIS do deploy
//       na Vercel, para os links já existirem. Não sobrescreve nome/descrição editados no painel:
//       só atualiza o arquivo quando ele mudou.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'catalogos');
const listFile = join(dir, 'catalogos.json');
const load = () => (existsSync(listFile) ? JSON.parse(readFileSync(listFile, 'utf8')) : []);
const save = (items) => writeFileSync(listFile, JSON.stringify(items.sort((a, b) => a.sortOrder - b.sortOrder), null, 1) + '\n');
const META = ['slug', 'kind', 'name', 'description', 'area', 'line', 'manufacturer', 'version', 'sortOrder', 'fileName', 'pages'];
const hash = (buf) => createHash('sha1').update(buf).digest('hex').slice(0, 8);

async function download(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function importar(base, only) {
  base = base.replace(/\/$/, '');
  const { items } = await (await fetch(`${base}/api/catalogos`)).json();
  const list = load();
  const picked = items.filter((i) => (only ? only.includes(i.slug) : !i.url.startsWith('/catalogos/')));
  if (only) for (const s of only) if (!picked.find((i) => i.slug === s)) throw new Error(`slug não encontrado: ${s}`);
  for (const it of picked) {
    const abs = (u) => (u.startsWith('/') ? base + u : u);
    const pdf = await download(abs(it.url));
    // nome com hash: um PDF substituído ganha URL nova e ninguém recebe a versão antiga do cache
    const arquivo = `arquivos/${it.slug}-${hash(pdf)}.pdf`;
    writeFileSync(join(dir, arquivo), pdf);
    let capa = null;
    if (it.coverUrl) {
      const jpg = await download(abs(it.coverUrl));
      capa = `capas/${it.slug}-${hash(jpg)}.jpg`;
      writeFileSync(join(dir, capa), jpg);
    }
    const entry = Object.fromEntries(META.map((k) => [k, it[k] ?? '']));
    const i = list.findIndex((x) => x.slug === it.slug);
    if (i >= 0) list.splice(i, 1);
    list.push({ ...entry, arquivo, capa });
    console.log('importado', it.slug, `(${(pdf.length / 1048576).toFixed(1)} MB)`);
  }
  save(list);
}

async function banco() {
  const { default: pg } = await import('pg');
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'off' ? false : { rejectUnauthorized: false } });
  await c.connect();
  for (const it of load()) {
    const url = `/catalogos/${it.arquivo}`;
    const coverUrl = it.capa ? `/catalogos/${it.capa}` : null;
    const size = readFileSync(join(dir, it.arquivo)).length;
    const { rows } = await c.query('select url from public.catalogos where slug = $1', [it.slug]);
    if (!rows.length) {
      await c.query(
        `insert into public.catalogos (kind, slug, name, description, area, line, manufacturer, version, url, cover_url, file_name, size, pages, sort_order)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [it.kind, it.slug, it.name, it.description, it.area, it.line, it.manufacturer, it.version, url, coverUrl, it.fileName, size, it.pages, it.sortOrder]);
      console.log('inserido', it.slug);
    } else if (rows[0].url !== url) {
      await c.query('update public.catalogos set url=$2, cover_url=$3, file_name=$4, size=$5, pages=$6, updated_at=now() where slug=$1',
        [it.slug, url, coverUrl, it.fileName, size, it.pages]);
      console.log('arquivo atualizado', it.slug);
    } else console.log('sem mudança', it.slug);
  }
  await c.end();
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'importar' && a) await importar(a, b ? b.split(',') : null);
else if (cmd === 'banco') await banco();
else { console.log('uso: node scripts/publicar.mjs importar <url> [slugs] | banco'); process.exit(1); }
