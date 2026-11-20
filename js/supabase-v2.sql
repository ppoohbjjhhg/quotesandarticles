-- Cole no Supabase (Editor SQL > Novo > Executar). Rode UMA vez.

-- 1) campos novos nos posts: fonte, cor, até 5 fotos, data de edição
alter table posts add column if not exists font text not null default '';
alter table posts add column if not exists color text not null default '';
alter table posts add column if not exists imgs jsonb not null default '[]'::jsonb;
alter table posts add column if not exists updated_at timestamptz;
alter table posts add constraint posts_max_5_fotos check (jsonb_array_length(imgs) <= 5);

-- 2) edição de posts (só o administrador)
create policy "admin edita" on posts for update to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@acervo.app')
  with check ((auth.jwt() ->> 'email') = 'admin@acervo.app');
grant update on public.posts to authenticated;

-- 3) foto de perfil
create table if not exists profile (
  id int primary key default 1 check (id = 1),
  avatar text
);
alter table profile enable row level security;
create policy "todos veem perfil" on profile for select using (true);
create policy "admin cria perfil" on profile for insert to authenticated
  with check ((auth.jwt() ->> 'email') = 'admin@acervo.app');
create policy "admin edita perfil" on profile for update to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@acervo.app')
  with check ((auth.jwt() ->> 'email') = 'admin@acervo.app');
grant select on public.profile to anon, authenticated;
grant insert, update on public.profile to authenticated;

-- 4) curtidas (registra o nome de quem curtiu)
create table if not exists likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  created_at timestamptz not null default now(),
  unique (post_id, name)
);
alter table likes enable row level security;
create policy "todos veem curtidas" on likes for select using (true);
grant select on public.likes to anon, authenticated;

create or replace function public.toggle_like(p_post uuid, p_name text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  p_name := left(btrim(p_name), 30);
  if p_name = '' then raise exception 'nome vazio'; end if;
  if exists (select 1 from likes where post_id = p_post and name = p_name) then
    delete from likes where post_id = p_post and name = p_name;
    return false;
  end if;
  insert into likes (post_id, name) values (p_post, p_name);
  return true;
end $$;
grant execute on function public.toggle_like(uuid, text) to anon, authenticated;
