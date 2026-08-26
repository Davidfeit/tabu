\set ON_ERROR_STOP on
do $$
declare v bigint; w text;
begin
  select version, state->>'writer' into v, w
    from game_state where room_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  -- בלי שמירת הגרסה, שני הכותבים היו מוחלים והגרסה הייתה 2.
  assert v = 1, 'שני כותבים מקבילים הוחלו! גרסה = ' || v;
  assert w in ('1','2'), 'מצב מעורבב: writer = ' || coalesce(w,'null');
  raise notice 'מרוץ: בדיוק כותב אחד הוחל (writer=%)', w;
end $$;
