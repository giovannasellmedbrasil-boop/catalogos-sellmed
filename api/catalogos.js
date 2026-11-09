import { listItems } from './_lib.js';

// Lista pública dos catálogos (cache curto na borda da Vercel)
export default async function handler(req, res) {
  try {
    const items = await listItems();
    // O cache fica só na CDN: com stale-while-revalidate no navegador, recarregar a página mostraria a lista antiga
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60');
    res.status(200).json({ items });
  } catch (e) {
    res.status(500).json({ error: 'Não foi possível carregar os catálogos.' });
  }
}
