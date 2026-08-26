-- אימות שכבת ההתחייבות מול Postgres אמיתי.
-- כל בדיקה זורקת אם ההתנהגות אינה כמצופה.
\set ON_ERROR_STOP on
\timing off

begin;

-- סביבת בדיקה: חדר אחד עם מצב התחלתי.
insert into game_rooms (id, code, host_id, status)
values ('11111111-1111-1111-1111-111111111111', 'TEST01',
        '22222222-2222-2222-2222-222222222222', 'active');

insert into game_state (room_id, version, seq, phase, current_seat, state)
values ('11111111-1111-1111-1111-111111111111', 5, 10, 'awaiting_roll', 0,
        '{"phase":"awaiting_roll","currentSeat":0,"turnDeadline":null,"cash":1000}'::jsonb);

do $$
declare r jsonb; v bigint;
begin
  -- (1) התחייבות תקינה מקדמת גרסה ומחזירה ok
  r := commit_move(
    '11111111-1111-1111-1111-111111111111', 5,
    '{"phase":"awaiting_end","currentSeat":0,"turnDeadline":null,"cash":400}'::jsonb,
    '[{"seq":11,"type":"bought","seat":0,"payload":{"pos":39}}]'::jsonb,
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333');
  assert r->>'ok' = 'true', 'התחייבות תקינה נכשלה: ' || r::text;
  assert (r->>'version')::bigint = 6, 'הגרסה לא התקדמה';

  select version into v from game_state
   where room_id = '11111111-1111-1111-1111-111111111111';
  assert v = 6, 'הגרסה בטבלה לא התעדכנה';

  -- המצב הנגזר מתעדכן יחד עם ה-jsonb
  assert (select phase from game_state
           where room_id = '11111111-1111-1111-1111-111111111111') = 'awaiting_end',
    'העמודה phase לא סונכרנה מה-jsonb';

  -- האירוע נכתב באותה טרנזקציה
  assert (select count(*) from game_events
           where room_id = '11111111-1111-1111-1111-111111111111') = 1,
    'האירוע לא נכתב';

  -- (2) גרסה מיושנת נדחית ולא משנה דבר
  r := commit_move(
    '11111111-1111-1111-1111-111111111111', 5,
    '{"phase":"finished","currentSeat":0,"turnDeadline":null,"cash":-999}'::jsonb,
    '[]'::jsonb,
    '22222222-2222-2222-2222-222222222222',
    '44444444-4444-4444-4444-444444444444');
  assert r->>'error' = 'STALE', 'גרסה מיושנת לא נדחתה: ' || r::text;
  assert (r->>'version')::bigint = 6, 'STALE לא החזיר את הגרסה הנוכחית';
  assert (select state->>'cash' from game_state
           where room_id = '11111111-1111-1111-1111-111111111111') = '400',
    'התחייבות שנדחתה בכל זאת שינתה מצב';

  -- (3) אידמפוטנטיות: אותו מפתח פעמיים מחזיר את התוצאה המקורית
  r := commit_move(
    '11111111-1111-1111-1111-111111111111', 6,
    '{"phase":"awaiting_roll","currentSeat":1,"turnDeadline":null,"cash":1}'::jsonb,
    '[]'::jsonb,
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333');
  assert r->>'replayed' = 'true', 'ניסיון חוזר לא זוהה: ' || r::text;
  assert (select version from game_state
           where room_id = '11111111-1111-1111-1111-111111111111') = 6,
    'ניסיון חוזר החיל את המהלך שוב';

  -- (4) חדר שאינו קיים מובחן מגרסה מיושנת
  r := commit_move(
    '99999999-9999-9999-9999-999999999999', 0, '{}'::jsonb, '[]'::jsonb,
    '22222222-2222-2222-2222-222222222222',
    '55555555-5555-5555-5555-555555555555');
  assert r->>'error' = 'NO_ROOM', 'חדר לא קיים לא זוהה: ' || r::text;

  -- (5) turnDeadline במילישניות מתורגם ל-timestamptz
  r := commit_move(
    '11111111-1111-1111-1111-111111111111', 6,
    '{"phase":"awaiting_roll","currentSeat":1,"turnDeadline":1700000000000,"cash":400}'::jsonb,
    '[]'::jsonb,
    '22222222-2222-2222-2222-222222222222',
    '66666666-6666-6666-6666-666666666666');
  assert r->>'ok' = 'true', 'התחייבות עם דדליין נכשלה';
  assert (select turn_deadline from game_state
           where room_id = '11111111-1111-1111-1111-111111111111')
         = to_timestamp(1700000000),
    'הדדליין לא תורגם נכון';

  -- (6) get_game_state מחזיר מצב וגרסה, ושעון שרת לתיקון סחיפה
  r := get_game_state('11111111-1111-1111-1111-111111111111');
  assert (r->>'version')::bigint = 7, 'get_game_state החזיר גרסה שגויה';
  assert (r->>'now')::bigint > 0, 'get_game_state לא החזיר שעון שרת';

  raise notice 'כל בדיקות commit_move עברו';
end $$;

-- (7) get_events_since מחזיר רק את מה שהוחמץ
do $$
declare n int;
begin
  select count(*) into n from get_events_since(
    '11111111-1111-1111-1111-111111111111', 10);
  assert n = 1, 'get_events_since החזיר ' || n || ' במקום 1';
  select count(*) into n from get_events_since(
    '11111111-1111-1111-1111-111111111111', 11);
  assert n = 0, 'get_events_since החזיר אירועים שכבר נראו';
  raise notice 'בדיקות get_events_since עברו';
end $$;

rollback;
