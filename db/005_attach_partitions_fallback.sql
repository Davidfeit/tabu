-- טאבו — עקיפה: מחיצות ל-realtime.messages דרך ATTACH
--
-- ⚠ זו עקיפה, לא הדרך הרגילה. הריצו אותה רק אם db/probe_broadcast.sql
--   ממשיכה להחזיר not_stored *אחרי* שלקוח כבר התחבר ל-Realtime.
--
-- הרקע: לתפקיד postgres ב-Supabase יש בעלות על realtime.messages אבל אין
-- לו CREATE על סכימת realtime, ולכן db/004 נכשל. מחיצה לא חייבת לשבת
-- בסכימה של האב — יוצרים אותה ב-public ומצרפים.
--
-- המחיר: אם שירות ה-Realtime ינסה בעצמו ליצור מחיצה לאותו יום, הוא ייפול
-- על "partition would overlap". לכן מצרפים רק את מה שחסר, ורק ליומיים.
--
-- ביטול (מחזיר את המצב לקדמותו, ואז Supabase יוצר בעצמו בהצלחה):
--   alter table realtime.messages detach partition public.<שם>;
--   drop table public.<שם>;

do $$
declare
  d    date;
  part text;
  made int := 0;
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'אין realtime.messages — מדלג';
    return;
  end if;

  for i in 0..1 loop
    d    := (now() at time zone 'utc')::date + i;
    part := 'tabu_rt_messages_' || to_char(d, 'YYYY_MM_DD');

    continue when to_regclass('public.' || quote_ident(part)) is not null;

    -- אין בדיקה מקדימה על חפיפה: ATTACH נופל מעצמו עם "would overlap",
    -- וזו בדיוק התשובה הנכונה — כבר יש מחיצה מכסה, אין מה לעשות.

    begin
      execute format(
        'create table public.%I (like realtime.messages including defaults including constraints)', part);
      execute format(
        'alter table realtime.messages attach partition public.%I '
        'for values from (%L) to (%L)', part, d, d + 1);
      made := made + 1;
      raise notice 'צורפה מחיצה public.%', part;
    exception when others then
      raise warning 'לא צורפה המחיצה %: %', part, sqlerrm;
      execute format('drop table if exists public.%I', part);
    end;
  end loop;

  if made = 0 then
    raise notice 'לא היה מה לצרף';
  end if;
end $$;
