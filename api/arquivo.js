import { getBySlug } from './_lib.js';

// Link estável e compartilhável (/c/slug): redireciona sempre para o PDF atual,
// mesmo depois de o catálogo ser substituído por uma versão nova
export default async function handler(req, res) {
  const { slug, baixar } = req.query || {};
  try {
    const p = /^[a-z0-9-]{1,90}$/.test(slug || '') ? await getBySlug(slug) : null;
    if (!p) return res.status(404).send('Catálogo não encontrado. Acesse a página de catálogos para ver a lista atual.');
    if (!p.url) return res.status(404).send(`O catálogo de ${p.name} estará disponível em breve.`);
    // PDFs do Git ficam na própria Vercel (/catalogos/arquivos/…); os enviados pelo painel ficam no Supabase Storage
    const url = !baixar ? p.url
      : p.url.startsWith('/catalogos/arquivos/') ? p.url.replace('/catalogos/arquivos/', '/catalogos/baixar/')
      : `${p.url}?download=${encodeURIComponent(p.fileName || 'catalogo.pdf')}`;
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, url);
  } catch (e) {
    res.status(500).send('Não foi possível abrir o catálogo. Tente novamente.');
  }
}
