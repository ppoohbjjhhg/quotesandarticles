-- Execute in Supabase SQL Editor to enable opt-in web push notifications.
create table if not exists public.push_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;
drop policy if exists "users manage their push subscriptions" on public.push_subscriptions;
create policy "users manage their push subscriptions" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

create table if not exists public.push_notification_deliveries (
  post_id text primary key,
  created_at timestamptz not null default now()
);

alter table public.push_notification_deliveries enable row level security;
revoke all on public.push_notification_deliveries from anon, authenticated;

create or replace function public.claim_push_notification(p_post_id text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.push_notification_deliveries (post_id)
  values (p_post_id)
  on conflict (post_id) do nothing;
  return found;
end;
$$;

revoke all on function public.claim_push_notification(text) from public, anon, authenticated;
grant execute on function public.claim_push_notification(text) to service_role;
