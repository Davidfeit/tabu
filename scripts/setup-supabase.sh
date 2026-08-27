#!/usr/bin/env bash
#
# מקים את כל צד השרת של טאבו בפרויקט Supabase חדש.
#
#   1. צרו פרויקט חינמי ב-supabase.com, אזור eu-central-1 (פרנקפורט)
#   2. Settings → Database → Connection string → לשונית **Session pooler**
#      (ולא Direct connection: למארח הישיר יש רשומת IPv6 בלבד, ולרוב הרשתות
#       הביתיות בישראל אין IPv6. גם לא Transaction pooler בפורט 6543 — מצב
#       transaction שובר DDL.) החליפו את הסיסמה בכתובת.
#   3. הריצו  npm run setup:supabase  — הסקריפט יבקש את המחרוזת ויקרא אותה
#      בלי להציג אותה. אפשר גם להגדיר מראש, למשל ב-CI:
#
#        export PGURL='postgresql://postgres.xxx:הסיסמה@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
#        npm run setup:supabase
#
#   PROJECT_REF נגזר מהכתובת אוטומטית.
#
# הסקריפט אידמפוטנטי — בטוח להריץ שוב.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

# ── חיבור ────────────────────────────────────────────────────────────────
# משותף עם scripts/realtime-partitions-fallback.sh. מגדיר die(), משיג
# PGURL ומוודא שהוא עובד — בלי זה placeholder מגיע עד כשל DNS עמום.
. "$SCRIPT_DIR/lib/pgurl.sh"

require_project_ref   # הפריסה בהמשך חייבת אותו

step() { printf '\n\033[1m→ %s\033[0m\n' "$1"; }

step "מחיל סכימה"
# 000_local_bootstrap.sql מדלגים עליו בכוונה: התפקידים ו-auth.uid()
# כבר קיימים ב-Supabase, והרצתו שם תיצור כפילויות.
for f in db/001_schema.sql db/002_commit_move.sql db/003_rls.sql \
         db/004_realtime_partitions.sql; do
  echo "   $f"
  psql "$PGURL" -v ON_ERROR_STOP=1 -q -f "$f"
done

step "בודק שהשידור מה-DB אכן מגיע ליעד"
# שתי הנחות נושאות, ואף אחת מהן לא מתועדת אצל Supabase:
#
#   א. realtime.send באמת מכניסה שורה. היא עוטפת את ההכנסה ב-EXCEPTION
#      WHEN OTHERS ומחזירה WARNING, ולכן שידור אבוד לא מייצר שום שגיאה
#      אצל הקורא — commit_move תצליח והלקוחות פשוט לא יעודכנו.
#   ב. השידור אטומי עם הטרנזקציה. אם לא, שידור יכול לשרוד מהלך שנכשל,
#      וכל הלקוחות ייתקעו על מצב שלא קיים.
#
# בקרה חיובית לפני בדיקת הביטול — בלעדיה "לא נוספה שורה" נראה כמו הצלחה.
# -q חיוני: בלעדיו psql מדפיס גם את תגי הפקודות ("CREATE TABLE", "DO"),
# והתוצאה מגיעה לכאן דבוקה אליהם.
PROBE="$(psql "$PGURL" -q -v ON_ERROR_STOP=1 -tA -f db/probe_broadcast.sql \
         | tail -n1 | tr -d '[:space:]')"

case "$PROBE" in
  ok)
    printf '   השידור נשמר, ומתבטל יחד עם הטרנזקציה\n' ;;
  no_realtime)
    printf '   אין סכימת realtime — מדלג (סביבה מקומית)\n' ;;
  not_stored)
    cat >&2 <<'WARN'

   ⚠ שידור מה-DB לא נשמר בכלל.

   realtime.send בולעת שגיאות הכנסה ומחזירה WARNING, ולכן זה לא מייצר
   שגיאה בשום מקום — המהלכים ייכתבו, והלקוחות פשוט לא יתעדכנו.
   הסיבה כמעט תמיד: אין מחיצה ל-realtime.messages לתאריך הנוכחי.

   db/004_realtime_partitions.sql מנסה ליצור אותן, ואם הוא לא הצליח
   (אין בעלות על הטבלה) שירות ה-Realtime יוצר אותן בעצמו ברגע
   שהלקוח הראשון מתחבר. הריצו את הסקריפט שוב אחרי החיבור הראשון —
   אם השורה הזו חוזרת, פתחו תקלה מול Supabase.

WARN
    printf '   אבחון:\n' >&2
    psql "$PGURL" -q -tA -f db/probe_broadcast_diag.sql 2>/dev/null \
      | sed 's/^/      /' >&2
    printf '\n' >&2
    ;;
  survived_rollback)
    cat >&2 <<'WARN'

   ⚠ שידור שרד ביטול טרנזקציה — ראו docs/deploy.md §2.
   השידור אינו אטומי עם המהלך, ולקוח עלול לקבל מצב שלא התחייב.

WARN
    ;;
  *)
    printf '   תוצאה לא מזוהה מהבדיקה: %s\n' "$PROBE" >&2 ;;
esac

step "פורס Edge Functions"
# הקיבוץ מריץ esbuild מ-node_modules. שכפול טרי של המאגר לא מתקין אותו,
# והכשל שם ("Cannot find package 'esbuild'") לא מרמז על התלויות.
if [[ ! -d node_modules/esbuild ]]; then
  printf '   מתקין תלויות (npm install)\n'
  npm install --no-audit --no-fund
fi
npm run build:engine

# פריסה דורשת הזדהות מול Supabase, שהיא נפרדת לגמרי מהחיבור לבסיס הנתונים.
# בלי הבדיקה הזו הסקריפט מגיע עד לכאן ונופל על JSON של LegacyPlatformAuthRequiredError.
SUPA=(npx --yes supabase@latest)
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]] && ! "${SUPA[@]}" projects list >/dev/null 2>&1; then
  printf '   דרושה הזדהות מול Supabase — נפתח דפדפן\n'
  "${SUPA[@]}" login
fi
# ההזדהות יכולה להצליח ובכל זאת להיות של חשבון אחר, ואז הפריסה נופלת על
# 403 גנרי שלא מזכיר את הפרויקט. עדיף לשאול מראש מה החשבון הזה בכלל רואה.
if ! PROJ="$("${SUPA[@]}" projects list 2>&1)" || [[ "$PROJ" != *"$PROJECT_REF"* ]]; then
  die "החשבון שמחובר ל-CLI לא רואה את הפרויקט $PROJECT_REF" \
      "" \
      "זה מסביר את ה-403: ההזדהות תקפה, אבל היא של חשבון אחר —" \
      "או של Personal Access Token עם הרשאות חלקיות." \
      "" \
      "מה שהחשבון הנוכחי רואה:" \
      "$PROJ" \
      "" \
      "תיקון:  unset SUPABASE_ACCESS_TOKEN" \
      "        npx supabase logout && npx supabase login" \
      "והתחברו עם החשבון שבבעלותו הפרויקט."
fi

# ה-CLI מחזיר 403 גנרי גם כשהחשבון נכון אבל התפקיד בארגון לא מרשה פריסה,
# וגם כש-Personal Access Token נוצר עם הרשאות חלקיות. אין דרך להבדיל מראש,
# ולכן מסבירים את שתי האפשרויות ברגע שזה קורה.
deploy_fn() {
  if ! "${SUPA[@]}" functions deploy "$1" --project-ref "$PROJECT_REF"; then
    die "פריסת הפונקציה $1 נכשלה" \
        "" \
        "אם השגיאה היא 403 (\"does not have the necessary privileges\"):" \
        "החשבון מזוהה, ורואה את הפרויקט, אבל אינו רשאי לפרוס אליו." \
        "" \
        "שתי סיבות אפשריות:" \
        "• התחברתם עם Personal Access Token שנוצר עם הרשאות חלקיות." \
        "  unset SUPABASE_ACCESS_TOKEN ואז npx supabase login מחדש." \
        "• התפקיד שלכם בארגון הוא Read-only או Developer." \
        "  בלוח הבקרה: Organization → Team, דרוש Owner או Administrator." \
        "" \
        "אפשר גם לפרוס ידנית מלוח הבקרה: Edge Functions → Deploy a new function," \
        "והקוד נמצא ב-supabase/functions/$1/."
  fi
}
deploy_fn play
deploy_fn ice

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
