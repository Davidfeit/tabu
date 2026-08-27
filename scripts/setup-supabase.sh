#!/usr/bin/env bash
#
# מקים את כל צד השרת של טאבו בפרויקט Supabase חדש.
#
#   1. צרו פרויקט חינמי ב-supabase.com, אזור eu-central-1 (פרנקפורט)
#   2. Settings → Database → Connection string → URI  (החליפו [YOUR-PASSWORD])
#   3. הריצו:
#
#        export PGURL='postgres://postgres:...@db.xxx.supabase.co:5432/postgres'
#        export PROJECT_REF='xxxxxxxxxxxx'      # מתוך אותה כתובת
#        scripts/setup-supabase.sh
#
# הסקריפט אידמפוטנטי — בטוח להריץ שוב.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${PGURL:?חסר PGURL — כתובת החיבור לבסיס הנתונים}"
: "${PROJECT_REF:?חסר PROJECT_REF — מזהה הפרויקט ב-Supabase}"

step() { printf '\n\033[1m→ %s\033[0m\n' "$1"; }

step "מחיל סכימה"
# 000_local_bootstrap.sql מדלגים עליו בכוונה: התפקידים ו-auth.uid()
# כבר קיימים ב-Supabase, והרצתו שם תיצור כפילויות.
for f in db/001_schema.sql db/002_commit_move.sql db/003_rls.sql; do
  echo "   $f"
  psql "$PGURL" -v ON_ERROR_STOP=1 -q -f "$f"
done

step "בודק את ההנחה הנושאת: שידור בטרנזקציה שבוטלה"
# כל הארכיטקטורה נשענת על כך ש-realtime.send אטומי עם הטרנזקציה, ותיעוד
# Supabase לא אומר זאת במפורש. אם זה לא מתקיים, שידור יכול להצליח בזמן
# שהמהלך נכשל, וכל הלקוחות ייתקעו על מצב שאינו קיים.
psql "$PGURL" -v ON_ERROR_STOP=1 -q <<'SQL'
do $$
declare n_before bigint; n_after bigint;
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'אין realtime.messages — מדלג על הבדיקה';
    return;
  end if;
  select count(*) into n_before from realtime.messages;
  begin
    perform public.tabu_broadcast('room:00000000-0000-0000-0000-000000000000',
                                  'probe', '{"probe":true}'::jsonb);
    raise exception 'rollback-probe';
  exception when others then
    if sqlerrm <> 'rollback-probe' then raise; end if;
  end;
  select count(*) into n_after from realtime.messages;
  if n_after > n_before then
    raise warning 'שידור שרד ביטול טרנזקציה — ראה docs/deploy.md §2';
  else
    raise notice 'הבדיקה עברה: שידור מבוטל יחד עם הטרנזקציה';
  end if;
end $$;
SQL

step "פורס Edge Functions"
npm run build:engine
npx --yes supabase@latest functions deploy play --project-ref "$PROJECT_REF"
npx --yes supabase@latest functions deploy ice  --project-ref "$PROJECT_REF"

step "נותר לכם ידנית (פעם אחת, בלוח הבקרה של Supabase)"
cat <<'MANUAL'
   • Authentication → Providers → Anonymous sign-ins: הפעילו
   • Realtime → Settings → "Allow public access": כבו
     (db/003_rls.sql כבר יצר את המדיניות שמחליפה אותו)
   • Edge Functions → Secrets → ALLOWED_ORIGIN = כתובת האתר שלכם
   • אופציונלי, ל-TURN: TURN_KEY_ID ו-TURN_KEY_API_TOKEN מ-Cloudflare

   ואז, בפרויקט האתר, שני משתני סביבה:
     VITE_SUPABASE_URL      = https://<ref>.supabase.co
     VITE_SUPABASE_ANON_KEY = מתוך Settings → API
MANUAL
printf '\n\033[1m✓ צד השרת מוכן\033[0m\n'
