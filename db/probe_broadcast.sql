-- טאבו — בדיקת שידור
--
-- מחזירה מילה אחת: ok / not_stored / survived_rollback / no_realtime.
-- הרצה:  psql "$PGURL" -tA -f db/probe_broadcast.sql
-- ההסבר המלא על מה נבדק כאן נמצא ב-scripts/setup-supabase.sh.

create temp table tabu_probe(kind text);
do $$
declare
  probe_topic constant text := 'room:00000000-0000-0000-0000-000000000000';
  n_stored int;
  n_after  int;
begin
  if to_regclass('realtime.messages') is null then
    insert into tabu_probe values ('no_realtime'); return;
  end if;

  delete from realtime.messages where topic = probe_topic;

  perform public.tabu_broadcast(probe_topic, 'probe', '{"probe":true}'::jsonb);
  select count(*) into n_stored from realtime.messages where topic = probe_topic;
  if n_stored = 0 then
    insert into tabu_probe values ('not_stored'); return;
  end if;
  delete from realtime.messages where topic = probe_topic;

  -- תת-טרנזקציה שמבוטלת: השידור אמור להתבטל יחד איתה.
  begin
    perform public.tabu_broadcast(probe_topic, 'probe', '{"probe":true}'::jsonb);
    raise exception 'rollback-probe';
  exception when others then
    if sqlerrm <> 'rollback-probe' then raise; end if;
  end;

  select count(*) into n_after from realtime.messages where topic = probe_topic;
  delete from realtime.messages where topic = probe_topic;
  insert into tabu_probe values (case when n_after > 0 then 'survived_rollback' else 'ok' end);
end $$;
select kind from tabu_probe;
