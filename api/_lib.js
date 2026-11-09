import pg from 'pg';
import { timingSafeEqual } from 'node:crypto';

// Lista dos catálogos no Postgres do Supabase (via pooler); PDFs e capas no Storage do Supabase
const pool = globalThis.__catalogosPool ||= new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'off' ? false : { rejectUnauthorized: false },
  max: 3,
});

const COLS = `id, kind, slug, name, description, area, line, manufacturer, version, url,
  cover_url as "coverUrl", file_name as "fileName", size::int, pages, sort_order as "sortOrder", updated_at as "updatedAt"`;

export async function listItems() {
  const { rows } = await pool.query(`select ${COLS} from public.catalogos order by sort_order, name`);
  return rows;
}

export async function getItem(id) {
  const { rows } = await pool.query(`select ${COLS} from public.catalogos where id = $1`, [id]);
  return rows[0] || null;
}

export async function getBySlug(slug) {
  const { rows } = await pool.query(`select ${COLS} from public.catalogos where slug = $1`, [slug]);
  return rows[0] || null;
}

export async function hasConsolidated() {
  const { rows } = await pool.query(`select 1 from public.catalogos where kind = 'consolidado'`);
  return rows.length > 0;
}

// Slug define o link compartilhável (/c/slug): é criado uma vez e não muda ao renomear
export const slugify = (s, fallback = 'catalogo') => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\.pdf$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || fallback;

async function freeSlug(base) {
  const { rows } = await pool.query(`select slug from public.catalogos where slug = $1 or slug like $2`, [base, `${base}-%`]);
  const used = new Set(rows.map((r) => r.slug));
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

export async function insertItem(p) {
  const slug = p.kind === 'consolidado' ? 'consolidado' : await freeSlug(slugify(p.name));
  await pool.query(
    `insert into public.catalogos (kind, slug, name, description, area, line, manufacturer, version, url, cover_url, file_name, size, pages, sort_order)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
       coalesce($14, (select coalesce(max(sort_order), 0) + 10 from public.catalogos)))`,
    [p.kind, slug, p.name, p.description, p.area, p.line, p.manufacturer, p.version, p.url, p.coverUrl, p.fileName, p.size, p.pages, p.sortOrder]);
}

export async function updateItem(id, p, file) {
  await pool.query(
    `update public.catalogos set name=$2, description=$3, area=$4, line=$5, manufacturer=$6, version=$7,
       sort_order=coalesce($8, sort_order) where id=$1`,
    [id, p.name, p.description, p.area, p.line, p.manufacturer, p.version, p.sortOrder]);
  if (file) {
    await pool.query('update public.catalogos set url=$2, cover_url=$3, file_name=$4, size=$5, pages=$6, updated_at=now() where id=$1',
      [id, file.url, file.coverUrl, file.fileName, file.size, file.pages]);
  }
}

export async function deleteItem(id) {
  await pool.query('delete from public.catalogos where id = $1', [id]);
}

export const BUCKET = 'catalogos';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const storageHeaders = () => ({ apikey: process.env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}` });
const PUBLIC_PREFIX = () => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;

export const publicUrl = (path) => PUBLIC_PREFIX() + path.split('/').map(encodeURIComponent).join('/');

// Caminho do arquivo dentro do bucket a partir da URL pública (só PDFs em arquivos/ e capas em capas/)
function storagePath(url) {
  if (typeof url !== 'string' || !url.startsWith(PUBLIC_PREFIX())) return null;
  const path = decodeURIComponent(url.slice(PUBLIC_PREFIX().length));
  return /^(arquivos\/[a-z0-9-]+\.pdf|capas\/[a-z0-9-]+\.jpg)$/.test(path) ? path : null;
}
export const isPdfFile = (url) => /^arquivos\//.test(storagePath(url) || '');
export const isCoverFile = (url) => /^capas\//.test(storagePath(url) || '');

// URL assinada para o navegador enviar o arquivo direto ao Storage (sem o limite de 4,5 MB da função)
export async function signUpload(path) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${path}`, { method: 'POST', headers: storageHeaders() });
  const d = await r.json();
  if (!r.ok) throw new Error(d.message || `storage ${r.status}`);
  return `${SUPABASE_URL}/storage/v1${d.url}`;
}

export async function removeFiles(urls) {
  const prefixes = urls.map(storagePath).filter(Boolean);
  if (!prefixes.length) return;
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: { ...storageHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes }),
  }).catch(() => {});
}

export function isAdmin(password) {
  const expected = process.env.ADMIN_PASSWORD || '';
  const a = Buffer.from(String(password || ''));
  const b = Buffer.from(expected);
  return expected.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}
