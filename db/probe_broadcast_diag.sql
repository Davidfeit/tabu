-- טאבו — אבחון כשל שידור
--
-- רץ רק כש-probe_broadcast.sql החזירה not_stored. מטרתו לענות על שאלה
-- אחת: מי כן רשאי ליצור מחיצות ל-realtime.messages, אם לא אנחנו.

select 'תפקיד נוכחי:            ' || current_user
union all
select 'בעלים של realtime.messages: ' ||
       coalesce((select pg_get_userbyid(relowner) from pg_class
                  where oid = to_regclass('realtime.messages')), '(אין טבלה)')
union all
select 'רשאי ליצור בסכימת realtime: ' ||
       has_schema_privilege(current_user, 'realtime', 'create')::text
union all
select 'רשאי ליצור בסכימת public:   ' ||
       has_schema_privilege(current_user, 'public', 'create')::text
union all
select 'מחיצות קיימות:          ' ||
       coalesce((select string_agg(c.relname, ', ' order by c.relname)
                   from pg_class c
                   join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'realtime'
                    and c.relname like 'messages\_%'), '(אין)')
union all
select 'פונקציות בסכימת realtime: ' ||
       coalesce((select string_agg(distinct p.proname, ', ' order by p.proname)
                   from pg_proc p
                   join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'realtime'), '(אין)');
