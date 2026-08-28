-- טאבו — סכימה
-- ✅ אדיטיבי בלבד, אידמפוטנטי. בטוח להריץ שוב בכל רגע.

create extension if not exists pgcrypto;

-- (1) חדרים
create table if not exists public.game_rooms (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  status        text not null default 'lobby'
                check (status in ('lobby','active','finished','abandoned')),
  host_id       uuid not null,
  max_players   smallint not null default 4 check (max_players between 2 and 4),
  settings      jsonb not null default '{}'::jsonb,
  -- מחויבות provably-fair: ה-hash מתפרסם בפתיחה, הזרע נחשף רק בסיום.
  server_seed_hash text,
  server_seed      text,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

create index if not exists game_rooms_status_idx on public.game_rooms (status, created_at desc);

-- (2) שחקנים בחדר
create table if not exists public.game_room_players (
  room_id       uuid not null references public.game_rooms(id) on delete cascade,
  user_id       uuid not null,
  seat          smallint not null check (seat between 0 and 5),
  display_name  text not null,
  token         text not null,
  status        text not null default 'active'
                check (status in ('active','bankrupt','left')),
  last_seen_at  timestamptz not null default now(),
  disconnected_at timestamptz,
  primary key (room_id, user_id),
  unique (room_id, seat)
);

-- (3) שורה אחת סמכותית לחדר: יעד הנעילה, וכל המשחק.
--
-- כל המצב ב-jsonb אחד במכוון. מצב המשחק הוא כמה KB, וזה הופך כל מהלך
-- לעדכון שורה אחת במקום שמונה טבלאות מנורמלות בטרנזקציה אחת. מנרמלים רק
-- את מה שנשאל *בין* משחקים.
create table if not exists public.game_state (
  room_id       uuid primary key references public.game_rooms(id) on delete cascade,
  version       bigint not null default 0,
  seq           bigint not null default 0,
  phase         text not null,
  current_seat  smallint not null,
  turn_deadline timestamptz,
  state         jsonb not null,
  updated_at    timestamptz not null default now()
);

-- (4) יומן אירועים append-only: השלמה בחיבור מחדש, ביקורת, ריפליי.
create table if not exists public.game_events (
  room_id       uuid not null references public.game_rooms(id) on delete cascade,
  seq           bigint not null,
  actor_id      uuid,
  type          text not null,
  payload       jsonb not null default '{}'::jsonb,
  version_after bigint not null,
  created_at    timestamptz not null default now(),
  primary key (room_id, seq)
);

-- (5) מונע החלה כפולה של אותו מהלך אחרי ניסיון חוזר ברשת.
create table if not exists public.game_action_intents (
  room_id         uuid not null references public.game_rooms(id) on delete cascade,
  idempotency_key uuid not null,
  user_id         uuid not null,
  result          jsonb not null,
  created_at      timestamptz not null default now(),
  primary key (room_id, idempotency_key)
);

create index if not exists game_action_intents_created_idx
  on public.game_action_intents (created_at);
