create table if not exists public.user_prompts (
  user_id uuid references auth.users(id) on delete cascade primary key,
  generated jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table public.user_prompts enable row level security;

create policy "user_prompts_select_own"
  on public.user_prompts
  for select
  using (auth.uid() = user_id);

create policy "user_prompts_insert_own"
  on public.user_prompts
  for insert
  with check (auth.uid() = user_id);

create policy "user_prompts_update_own"
  on public.user_prompts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_prompts_service_role"
  on public.user_prompts
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
