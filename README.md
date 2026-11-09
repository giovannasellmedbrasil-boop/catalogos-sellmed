# Catálogos de Produtos · Sellmed Brasil

Plataforma com o catálogo consolidado e o catálogo individual de cada produto, em PDF.

- `index.html` — página pública: catálogo consolidado em destaque, busca, filtros por área, linha e
  fabricante, e em cada produto: ver, baixar e copiar link.
- `admin.html` — painel com senha: enviar, editar, substituir e remover catálogos.

**Status:** pronta e testada localmente; ainda não publicada.

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
