import { deleteItem, getItem, hasConsolidated, insertItem, isAdmin, isCoverFile, isPdfFile, listItems, readJson, removeFiles, updateItem } from '../_lib.js';

const clean = (s, max) => String(s || '').trim().slice(0, max);
const intOrNull = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Math.trunc(Number(v)));

// Ações do painel: login, add, update, delete
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { password, action, item = {} } = await readJson(req);
    if (!isAdmin(password)) return res.status(401).json({ error: 'Senha incorreta.' });

    const fields = {
      name: clean(item.name, 120),
      description: clean(item.description, 300),
      area: clean(item.area, 60),
      line: clean(item.line, 60),
      manufacturer: clean(item.manufacturer, 60),
      version: clean(item.version, 40),
      sortOrder: intOrNull(item.sortOrder),
    };
    const file = item.url ? {
      url: item.url,
      coverUrl: isCoverFile(item.coverUrl) ? item.coverUrl : null,
      fileName: clean(item.fileName, 200),
      size: Number(item.size) || 0,
      pages: Number(item.pages) || 0,
    } : null;
    const invalid = (kind) => {
      if (!fields.name) return 'Informe o nome.';
      if (kind === 'produto' && !fields.area) return 'Informe a área.';
      return '';
    };

    if (action === 'add') {
      const kind = item.kind === 'consolidado' ? 'consolidado' : 'produto';
      const err = invalid(kind);
      if (err) return res.status(400).json({ error: err });
      if (!file || !isPdfFile(file.url)) return res.status(400).json({ error: 'Arquivo inválido.' });
      if (kind === 'consolidado' && await hasConsolidated()) return res.status(409).json({ error: 'Já existe um catálogo consolidado. Use Substituir.' });
      await insertItem({ ...fields, ...file, kind });
    } else if (action === 'update' || action === 'delete') {
      const old = await getItem(item.id);
      if (!old) return res.status(404).json({ error: 'Catálogo não encontrado.' });
      if (action === 'delete') {
        await deleteItem(old.id);
        await removeFiles([old.url, old.coverUrl]);
      } else {
        const err = invalid(old.kind);
        if (err) return res.status(400).json({ error: err });
        const replaced = file && file.url !== old.url;
        if (replaced && !isPdfFile(file.url)) return res.status(400).json({ error: 'Arquivo inválido.' });
        await updateItem(old.id, fields, replaced ? file : null);
        if (replaced) await removeFiles([old.url, old.coverUrl]);
      }
    } else if (action !== 'login') {
      return res.status(400).json({ error: 'Ação inválida.' });
    }

    res.status(200).json({ items: await listItems() });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao salvar: ' + e.message });
  }
}
