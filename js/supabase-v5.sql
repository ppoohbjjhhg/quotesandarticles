-- Cole no Supabase (Editor SQL > Novo > Executar), depois do SQL v4.

-- 1) Identifica o autor; posts antigos continuam atribuídos ao administrador.
alter table public.posts
  add column if not exists author_id uuid references auth.users(id) on delete set null;

-- Leitores só podem criar, editar e apagar publicações próprias.
drop policy if exists "leitor cria propria publicacao" on public.posts;
create policy "leitor cria propria publicacao" on public.posts
  for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists "leitor edita propria publicacao" on public.posts;
create policy "leitor edita propria publicacao" on public.posts
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "leitor apaga propria publicacao" on public.posts;
create policy "leitor apaga propria publicacao" on public.posts
  for delete to authenticated
  using (author_id = auth.uid());

grant insert, update, delete on public.posts to authenticated;

-- 2) Registra publicações acumuladas. Excluir um post não remove o selo já ganho.
create table if not exists public.publication_counts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total integer not null default 0 check (total >= 0)
);

alter table public.publication_counts enable row level security;
drop policy if exists "selos de publicacao visiveis" on public.publication_counts;
create policy "selos de publicacao visiveis" on public.publication_counts
  for select to anon, authenticated
  using (true);

revoke all on public.publication_counts from anon, authenticated;
grant select on public.publication_counts to anon, authenticated;

create or replace function public.track_post_publication()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.author_id is not null then
    insert into public.publication_counts as pc (user_id, total)
    values (new.author_id, 1)
    on conflict (user_id) do update set total = pc.total + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists track_post_publication on public.posts;
create trigger track_post_publication
  after insert on public.posts
  for each row execute function public.track_post_publication();

-- 3) Leitores enviam e apagam imagens apenas na pasta identificada pelo próprio UID.
drop policy if exists "leitor envia imagens na propria pasta" on storage.objects;
create policy "leitor envia imagens na propria pasta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "leitor apaga imagens da propria pasta" on storage.objects;
create policy "leitor apaga imagens da propria pasta" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "admin apaga imagens de publicacoes" on storage.objects;
create policy "admin apaga imagens de publicacoes" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'images'
    and (auth.jwt() ->> 'email') = 'admin@acervo.app'
  );
