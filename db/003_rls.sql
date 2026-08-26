-- טאבו — הרשאות
--
-- העיקרון: **הלקוח לעולם לא כותב מצב משחק.** הוא קורא, ושולח פעולות
-- ל-Edge Function שמריצה את המנוע ומתחייבת. לכן commit_move אינה חשופה
-- ללקוח בכלל, וטבלאות המצב פתוחות לו לקריאה בלבד.

alter table public.game_rooms          enable row level security;
alter table public.game_room_players   enable row level security;
alter table public.game_state          enable row level security;
alter table public.game_events         enable row level security;
alter table public.game_action_intents enable row level security;

-- חברות בחדר. security definer כדי שלא תיווצר רקורסיה של RLS.
create or replace function public.is_room_member(p_room uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from game_room_players
     where room_id = p_room and user_id = p_user and status <> 'left');
$$;

-- ── קריאה ────────────────────────────────────────────────────────────────

drop policy if exists rooms_read on public.game_rooms;
create policy rooms_read on public.game_rooms
  for select to authenticated
  using (is_room_member(id, auth.uid()) or status = 'lobby');

drop policy if exists players_read on public.game_room_players;
create policy players_read on public.game_room_players
  for select to authenticated
  using (is_room_member(room_id, auth.uid()));

drop policy if exists state_read on public.game_state;
create policy state_read on public.game_state
  for select to authenticated
  using (is_room_member(room_id, auth.uid()));

drop policy if exists events_read on public.game_events;
create policy events_read on public.game_events
  for select to authenticated
  using (is_room_member(room_id, auth.uid()));

-- ── כתיבה ────────────────────────────────────────────────────────────────
-- אין אף מדיניות כתיבה ל-authenticated. service_role עוקף RLS ממילא,
-- וזה בדיוק ומדויק מי שרשאי לכתוב: ה-Edge Function.

do $$
declare t text;
begin
  foreach t in array array['game_state','game_events','game_action_intents'] loop
    execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
  end loop;
  execute 'revoke insert, update, delete on public.game_rooms from anon, authenticated';
  execute 'revoke insert, update, delete on public.game_room_players from anon, authenticated';
end $$;

-- commit_move היא security definer ולכן עוקפת RLS. היא חייבת להיות סגורה
-- ללקוח — אחרת שחקן יכול לכתוב כל מצב שירצה, וכל מודל הסמכות מתמוטט.
revoke all on function public.commit_move(uuid, bigint, jsonb, jsonb, uuid, uuid)
  from public, anon, authenticated;

-- קריאה בטוחה: מחזירות רק מצב של חדר שהקורא חבר בו.
revoke all on function public.get_game_state(uuid) from public, anon;
revoke all on function public.get_events_since(uuid, bigint) from public, anon;

-- ── שידורים פרטיים ───────────────────────────────────────────────────────
--
-- Realtime מחשב הרשאות מ-RLS על realtime.messages בזמן ההצטרפות לערוץ.
-- הלקוח חייב config: { private: true } ו-setAuth() לפני ההרשמה.
--
-- ⚠️ שתי אזהרות מהתיעוד של Supabase, שיש לתכנן סביבן:
--   1. ההרשאות נשמרות במטמון לכל אורך החיבור. שחקן שהוסר מחדר ימשיך לקבל
--      שידורים עד שיתחבר מחדש. מיטיגציה: JWT קצר וכפיית setAuth בשינוי חברות.
--   2. מדיניות מורכבת מאטה את זמן ההצטרפות. לכן זו בדיקה אחת באינדקס.
do $$
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'סכימת realtime לא קיימת — מדלג על מדיניות השידורים (פיתוח מקומי)';
    return;
  end if;

  execute $p$drop policy if exists tabu_broadcast_read on realtime.messages$p$;
  execute $p$
    create policy tabu_broadcast_read on realtime.messages
      for select to authenticated
      using (
        extension = 'broadcast'
        and realtime.topic() like 'room:%'
        and public.is_room_member(
              replace(realtime.topic(), 'room:', '')::uuid, auth.uid())
      )$p$;

  -- הלקוח לא משדר אירועי משחק. רק ה-DB עושה זאת, דרך commit_move.
  execute $p$drop policy if exists tabu_broadcast_write on realtime.messages$p$;
end $$;
