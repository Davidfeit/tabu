-- אימות שהלקוח לא יכול לכתוב מצב משחק.
\set ON_ERROR_STOP on
begin;

insert into game_rooms (id, code, host_id, status)
values ('cccccccc-0000-0000-0000-000000000001', 'RLS001',
        'dddddddd-0000-0000-0000-000000000001', 'active');
insert into game_state (room_id, version, seq, phase, current_seat, state)
values ('cccccccc-0000-0000-0000-000000000001', 0, 0, 'awaiting_roll', 0, '{}'::jsonb);
insert into game_room_players (room_id, user_id, seat, display_name, token)
values ('cccccccc-0000-0000-0000-000000000001',
        'dddddddd-0000-0000-0000-000000000001', 0, 'דנה', 'camel');

do $$
declare denied boolean;
begin
  -- (1) חבר בחדר רואה את המצב
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',
                     'dddddddd-0000-0000-0000-000000000001', true);
  assert (select count(*) from game_state
           where room_id = 'cccccccc-0000-0000-0000-000000000001') = 1,
    'חבר בחדר לא רואה את המצב';

  -- (2) מי שאינו חבר לא רואה כלום
  perform set_config('request.jwt.claim.sub',
                     'eeeeeeee-0000-0000-0000-000000000009', true);
  assert (select count(*) from game_state
           where room_id = 'cccccccc-0000-0000-0000-000000000001') = 0,
    'זר רואה מצב של חדר שאינו שלו';

  -- (3) לקוח לא יכול לכתוב מצב, גם כשהוא חבר בחדר
  perform set_config('request.jwt.claim.sub',
                     'dddddddd-0000-0000-0000-000000000001', true);
  denied := false;
  begin
    update game_state set state = '{"hacked":true}'::jsonb
     where room_id = 'cccccccc-0000-0000-0000-000000000001';
  exception when insufficient_privilege then denied := true;
  end;
  assert denied, 'לקוח הצליח לכתוב ישירות לטבלת המצב!';

  -- (4) commit_move סגורה בפני הלקוח — אחרת כל מודל הסמכות מתמוטט
  denied := false;
  begin
    perform commit_move('cccccccc-0000-0000-0000-000000000001', 0,
                        '{"phase":"finished","currentSeat":0}'::jsonb,
                        '[]'::jsonb, 'dddddddd-0000-0000-0000-000000000001',
                        gen_random_uuid());
  exception when insufficient_privilege then denied := true;
  end;
  assert denied, 'לקוח הצליח לקרוא ל-commit_move!';

  reset role;
  raise notice 'בדיקות RLS עברו';
end $$;

rollback;
