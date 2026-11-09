# Catálogos de Produtos · Sellmed Brasil

Plataforma com o catálogo consolidado e o catálogo individual de cada produto, em PDF.

- `index.html` — página pública: catálogo consolidado em destaque, busca, filtros por área, linha e
  fabricante, e em cada produto: ver, baixar e copiar link.
- `admin.html` — painel com senha: enviar, editar, substituir e remover catálogos.

- **Página pública:** https://catalogos-sellmed.vercel.app
- **Painel:** https://catalogos-sellmed.vercel.app/admin.html

**Status:** publicada e funcionando (Vercel `catalogos-sellmed` + Supabase `jlfzuibanroexvnwyeti`).
O envio de PDF pelo painel foi testado em produção em 09/11/2026.

## Como usar o painel
1. Entre com a senha de administrador.
2. **Catálogo consolidado → Substituir / editar** para trocar o PDF geral.
3. **+ Novo produto** → arraste o PDF (até 50 MB), preencha nome e área (linha, fabricante, versão
   e ordem são opcionais) → **Publicar**. A capa é criada sozinha a partir da 1ª página do PDF.
4. **Editar** em um produto permite mudar os dados ou substituir o PDF. O arquivo antigo é apagado.
5. **Remover** apaga o PDF e tira o produto da página pública.

Cada catálogo tem um link fixo, `/c/nome-do-produto`. Ele continua funcionando quando o PDF é
substituído ou o produto é renomeado, então links já enviados por WhatsApp não quebram.
A página pública pode levar até ~15 segundos para mostrar uma alteração.

## Fluxo Git + Supabase + Vercel (como os catálogos são publicados)
Desde 09/11/2026 todo catálogo novo ou substituído vai para os três:
- **Git:** o PDF e a capa ficam em `catalogos/arquivos/` e `catalogos/capas/`, e a lista em `catalogos/catalogos.json`.
- **Vercel:** publica essa pasta. Os PDFs são servidos em `/catalogos/arquivos/…`.
- **Supabase:** a tabela `catalogos` guarda o que aparece no site, e o Storage (bucket `catalogos`)
  guarda uma cópia de cada PDF e capa, com os mesmos nomes. O `banco` envia essa cópia quando recebe
  `SUPABASE_URL` e `SUPABASE_SECRET_KEY`.

Os arquivos levam um hash no nome, então um PDF substituído ganha um endereço novo, sem cache antigo.
Os links fixos `/c/<produto>` continuam os mesmos.

Passo a passo depois de subir um catálogo pelo painel (produção ou prévia local):
```
node scripts/publicar.mjs importar <url-do-site> [slug,slug]   # baixa para catalogos/
git add catalogos && git commit -m "Catálogos: …" && git push
npx vercel@latest deploy --prod --yes --scope sellmed-brasil
DATABASE_URL=… SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/publicar.mjs banco   # tabela + Storage
```
Para remover um catálogo de vez, tire-o do `catalogos.json` e da pasta, além de remover no painel.
Se não fizer isso, o próximo `banco` o recoloca no site.

## Conteúdo inicial
`seed/` tem o catálogo consolidado, 49 PDFs individuais (cada um é a página do produto no consolidado)
e as capas. Gerado por `scripts/gerar-seed.py`, onde estão as tabelas de produto, área, linha e fabricante.
`seed/` não vai para o Git nem para a Vercel; só é usado para preencher a plataforma uma vez.

## Ver no computador, sem publicar
```
npm install
npm run local
```
Abre em http://localhost:4173 (senha do painel: `local`), usando as mesmas funções de `api/` da
produção, com banco embutido e arquivos em `.local/`. Nada sai do computador.

## Publicar pela primeira vez
Mesmo modelo do Portal de Políticas: Vercel (hospedagem e funções) + Supabase (tabela e arquivos).
Passos 1, 2 (menos `SUPABASE_SECRET_KEY`) e 4 já feitos em 09/11/2026.
1. Rodar `supabase/schema.sql` no projeto Supabase. Cria a tabela `catalogos` e o bucket `catalogos`.
2. Criar o projeto `catalogos-sellmed` na Vercel (time `sellmed-brasil`) com as variáveis
   `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` e `ADMIN_PASSWORD`.
3. Enviar o conteúdo inicial: `DATABASE_URL=… SUPABASE_URL=… SUPABASE_SECRET_KEY=… npm run seed`
   (pode repetir: não duplica nem sobrescreve o que foi editado no painel).
4. `npx vercel@latest deploy --prod --yes --scope sellmed-brasil`

`DATABASE_URL` usa o pooler do Supabase (porta 6543): o host direto do banco só tem IPv6 e não funciona na Vercel.

## Arquivos
- `api/catalogos.js` — lista pública · `api/arquivo.js` — link fixo, ver e baixar ·
  `api/upload.js` — autoriza envio de PDF e capa · `api/admin/save.js` — login, adicionar, editar, remover.
- `assets/vendor/` — pdf.js 4.10.38, usado no painel para gerar as capas.
