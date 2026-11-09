-- Plataforma de Catálogos Sellmed — lista de catálogos (PDFs e capas no bucket "catalogos")
create table if not exists public.catalogos (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null default 'produto' check (kind in ('consolidado', 'produto')),
  slug         text not null unique check (slug ~ '^[a-z0-9-]{1,90}$'),
  name         text not null check (char_length(name) between 1 and 120),
  description  text not null default '' check (char_length(description) <= 300),
  area         text not null default '' check (char_length(area) <= 60),
  line         text not null default '' check (char_length(line) <= 60),
  manufacturer text not null default '' check (char_length(manufacturer) <= 60),
  version      text not null default '' check (char_length(version) <= 40),
  url          text not null,
  cover_url    text,
  file_name    text not null default '',
  size         bigint not null default 0,
  pages        int not null default 0,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Só pode existir um catálogo consolidado
create unique index if not exists catalogos_um_consolidado on public.catalogos (kind) where kind = 'consolidado';

-- Acesso só pelas funções da Vercel (conexão direta ao Postgres); nada exposto pela API pública do Supabase
alter table public.catalogos enable row level security;
revoke all on public.catalogos from anon, authenticated;

-- Bucket público (leitura pública; envio/remoção só pelo servidor com a chave secreta)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalogos', 'catalogos', true, 52428800, array['application/pdf', 'image/jpeg'])
on conflict (id) do nothing;
