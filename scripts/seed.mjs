// Publica o conteúdo inicial (seed/) no Supabase: PDFs, capas e linhas da tabela.
// Pode ser executado de novo: não duplica e não sobrescreve o que já foi editado no painel.
// Precisa de DATABASE_URL, SUPABASE_URL e SUPABASE_SECRET_KEY no ambiente.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed');
const base = process.env.SUPABASE_URL.replace(/\/$/, '');
const key = process.env.SUPABASE_SECRET_KEY;
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'off' ? false : { rejectUnauthorized: false },
});

async function put(path, type) {
  const body = await readFile(join(root, path));
  const r = await fetch(`${base}/storage/v1/object/catalogos/${path}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': type, 'x-upsert': 'true' },
    body,
  });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  return { url: `${base}/storage/v1/object/public/catalogos/${path}`, size: body.length };
}

await client.connect();
const items = JSON.parse(await readFile(join(root, 'catalogos.json'), 'utf8'));
let added = 0;
for (const it of items) {
  const { rows } = await client.query('select 1 from public.catalogos where slug = $1', [it.slug]);
  if (rows.length) continue;
  const pdf = await put(it.file, 'application/pdf');
  const capa = await put(it.cover, 'image/jpeg');
  await client.query(
    `insert into public.catalogos (kind, slug, name, description, area, line, manufacturer, version, url, cover_url, file_name, size, pages, sort_order)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [it.kind, it.slug, it.name, it.description, it.area, it.line, it.manufacturer, it.version, pdf.url, capa.url, it.fileName, pdf.size, it.pages, it.sortOrder]);
  added++;
  console.log('ok', it.slug);
}
await client.end();
console.log(`${added} adicionados, ${items.length - added} já existiam.`);
