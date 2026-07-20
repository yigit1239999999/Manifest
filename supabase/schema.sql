-- Tamamlandı ✦ — Supabase şeması
-- Supabase Dashboard → SQL Editor'e yapıştır ve Run de.

create table if not exists manifest_entries (
  id uuid primary key,
  kind text not null,
  content text not null default '',
  meta jsonb not null default '{}'::jsonb,
  day date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists manifest_entries_kind_idx on manifest_entries (kind, day);

alter table manifest_entries enable row level security;

-- Kişisel tek kullanıcılı kurulum: anon anahtarıyla tam erişim.
-- (Anahtarını kimseyle paylaşma — erişim anahtarın bilenlerle sınırlı.)
drop policy if exists "anon full access" on manifest_entries;
create policy "anon full access" on manifest_entries
  for all to anon using (true) with check (true);
