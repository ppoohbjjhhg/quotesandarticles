-- Cole no Supabase: SQL Editor > New query > Run.
-- Se usar outro e-mail de administrador, troque 'admin@acervo.app' nas 6 linhas abaixo.

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  cat text not null check (cat in ('quote','nota','estudo','artigo')),
  title text not null default '',
  text text not null default '',
  img text,
  created_at timestamptz not null default now()
);

alter table posts enable row level security;

create policy "todos leem" on posts for select using (true);
create policy "admin publica" on posts for insert to authenticated
  with check ((auth.jwt() ->> 'email') = 'admin@acervo.app');
create policy "admin apaga" on posts for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@acervo.app');

insert into storage.buckets (id, name, public) values ('images', 'images', true)
  on conflict (id) do nothing;

create policy "todos veem imagens" on storage.objects for select using (bucket_id = 'images');
create policy "admin envia imagens" on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and (auth.jwt() ->> 'email') = 'admin@acervo.app');
create policy "admin apaga imagens" on storage.objects for delete to authenticated
  using (bucket_id = 'images' and (auth.jwt() ->> 'email') = 'admin@acervo.app');
