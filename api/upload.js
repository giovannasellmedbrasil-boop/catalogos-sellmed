import { randomBytes } from 'node:crypto';
import { isAdmin, publicUrl, readJson, signUpload, slugify } from './_lib.js';

const MAX_PDF = 50 * 1024 * 1024;
const MAX_CAPA = 2 * 1024 * 1024;

// Autoriza o envio de um PDF ou capa: devolve a URL assinada de upload e a URL pública final
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { password, name, size, type } = await readJson(req);
    if (!isAdmin(password)) return res.status(401).json({ error: 'Senha de administrador inválida.' });
    const capa = type === 'capa';
    if (!(Number(size) > 0 && Number(size) <= (capa ? MAX_CAPA : MAX_PDF))) {
      return res.status(400).json({ error: capa ? 'Capa acima de 2 MB.' : 'O PDF deve ter até 50 MB.' });
    }
    const path = `${capa ? 'capas' : 'arquivos'}/${slugify(name)}-${randomBytes(5).toString('hex')}.${capa ? 'jpg' : 'pdf'}`;
    res.status(200).json({ uploadUrl: await signUpload(path), url: publicUrl(path) });
  } catch (e) {
    res.status(500).json({ error: 'Não foi possível preparar o envio: ' + e.message });
  }
}
