\set ON_ERROR_STOP on
delete from game_rooms where id = 'aaaaaaaa-0000-0000-0000-000000000001';
insert into game_rooms (id, code, host_id, status)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'RACE01',
        'bbbbbbbb-0000-0000-0000-000000000001', 'active');
insert into game_state (room_id, version, seq, phase, current_seat, state)
values ('aaaaaaaa-0000-0000-0000-000000000001', 0, 0, 'awaiting_roll', 0,
        '{"phase":"awaiting_roll","currentSeat":0,"turnDeadline":null,"writer":0}'::jsonb);
