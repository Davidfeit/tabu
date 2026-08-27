-- טאבו — מחיצות ל-realtime.messages
--
-- realtime.send של Supabase עוטפת את ההכנסה ב-EXCEPTION WHEN OTHERS ומחזירה
-- WARNING בלבד. המשמעות: אם אין מחיצה ליום הנוכחי, כל שידור מה-DB נעלם
-- בשקט — commit_move מצליחה, המצב נשמר, ואף לקוח לא מקבל הודעה. זה בדיוק
-- סוג התקלה שלא מתגלה עד שמשחקים.
--
-- שירות ה-Realtime יוצר את המחיצות בעצמו, אבל בפרויקט חדש שאיש עדיין לא
-- התחבר אליו הן עלולות לא להתקיים. הקובץ הזה משלים אותן מראש והוא
-- אידמפוטנטי — מחיצה קיימת מדולגת, וכישלון ביצירה הוא אזהרה ולא שגיאה
-- (ייתכן שאין לתפקיד בעלות על realtime.messages, ואז השירות יטפל בזה).

do $$
declare
  d    date;
  part text;
  made int := 0;
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'אין realtime.messages — מדלג (סביבה מקומית)';
    return;
  end if;

  -- אתמול ועד שבוע קדימה: מכסה הפרשי אזור־זמן וגם שבוע בלי שהשירות רץ.
  for i in -1..7 loop
    d    := (now() at time zone 'utc')::date + i;
    part := 'messages_' || to_char(d, 'YYYY_MM_DD');

    continue when to_regclass('realtime.' || quote_ident(part)) is not null;

    begin
      execute format(
        'create table realtime.%I partition of realtime.messages '
        'for values from (%L) to (%L)', part, d, d + 1);
      made := made + 1;
    exception when others then
      raise warning 'לא נוצרה המחיצה %: %', part, sqlerrm;
    end;
  end loop;

  if made > 0 then
    raise notice 'נוצרו % מחיצות ל-realtime.messages', made;
  end if;
end $$;
