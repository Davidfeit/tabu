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

# ── האם הקוד כאן עדכני? ──────────────────────────────────────────────────
#
# הפריסה מעלה את הקבצים שיושבים כאן *עכשיו*. קרה בפועל: git pull נכשל
# ("cannot pull with rebase: You have unstaged changes"), השורה נבלעה בין
# שאר הפלט, והסקריפט פרס בשקט את הגרסה הישנה. מהדפדפן זה נראה כמו תקלה
# באפליקציה ולא כמו קוד ישן, ולכן זה נבדק לפני שנוגעים במשהו.
sayfail() { printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2; shift
            for l in "$@"; do printf '   %s\n' "$l" >&2; done; exit 1; }

if git rev-parse --git-dir >/dev/null 2>&1; then
  DIRTY="$(git status --porcelain --untracked-files=no 2>/dev/null || true)"
  UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
  if [[ -n "$UPSTREAM" ]] && git fetch --quiet 2>/dev/null; then
    BEHIND="$(git rev-list --count "HEAD..$UPSTREAM" 2>/dev/null || echo 0)"
    if [[ "${BEHIND:-0}" -gt 0 ]]; then
      NOTE=()
      if [[ -n "$DIRTY" ]]; then
        NOTE=("" "git pull נכשל כנראה בגלל הקבצים ששונו כאן:"
              "$(printf '%s' "$DIRTY" | sed 's/^/     /')"
              "" "אם לא ערכתם אותם בעצמכם — הם נוצרו בהרצה קודמת, ואפשר לזרוק:"
              "   git checkout -- . && git pull")
      else
        NOTE=("" "   git pull")
      fi
      sayfail "הקוד כאן ישן ב-$BEHIND קומיטים מ-$UPSTREAM" \
        "" \
        "פריסה עכשיו תעלה לענן את הגרסה הישנה, וזה ייראה בדפדפן" \
        "כמו תקלה באפליקציה. קודם מעדכנים:" "${NOTE[@]}"
    fi
  fi
  # לא בתנאי מקוצר: תחת set -e, && שנכשל בסוף בלוק מפיל את הסקריפט.
  if [[ -n "$DIRTY" ]]; then
    printf '   שינויים מקומיים שייפרסו כמות שהם:\n%s\n' \
      "$(printf '%s' "$DIRTY" | sed 's/^/      /')"
  fi
fi

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

step "מוודא שהמדיניות אכן קיימת"
# "הרצתי ולא השתנה כלום" הוא מבוי סתום. כאן נאמר בפירוש מה קיים בפועל,
# כדי שלא נצטרך לנחש אם ההרצה תפסה.
psql "$PGURL" -q -tA <<'SQL' | sed 's/^/   /'
select coalesce(
  (select string_agg(policyname, ', ' order by policyname)
     from pg_policies
    where schemaname = 'realtime' and tablename = 'messages'),
  '(אין מדיניות על realtime.messages)');
SQL
printf '   דרושות: tabu_broadcast_read, tabu_signal_read, tabu_signal_write\n'

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
sees_project() { "${SUPA[@]}" projects list 2>&1 | grep -q "$PROJECT_REF"; }

if ! sees_project; then
  printf '\n   החשבון שמחובר ל-CLI לא רואה את הפרויקט %s.\n' "$PROJECT_REF" >&2
  printf '   מה שהוא כן רואה:\n\n' >&2
  "${SUPA[@]}" projects list 2>&1 | sed 's/^/      /' >&2

  # התחברות מחדש בדפדפן תיתן את אותו חשבון, כי הדפדפן כבר מזוהה איתו.
  # אסימון אישי חותך את זה: הוא נוצר מתוך החשבון הנכון ולא תלוי בסשן.
  if [[ -t 0 ]]; then
    cat >&2 <<ASK

   כנראה יצרתם את הפרויקט בחשבון Supabase אחר.

   התחברות מחדש בדפדפן לרוב תחזיר את אותו חשבון, כי הדפדפן כבר מחובר
   אליו. הדרך הישירה היא אסימון אישי מתוך החשבון הנכון:

   1. פתחו את הפרויקט ב-supabase.com/dashboard/project/$PROJECT_REF
      (אם אתם לא רואים אותו — אתם מחוברים בדפדפן לחשבון הלא נכון)
   2. Account → Access Tokens → Generate new token
   3. הדביקו כאן. ריק = דילוג על הפריסה.

ASK
    printf '   אסימון (sbp_...): ' >&2
    IFS= read -rs TOKEN || true
    printf '\n' >&2
    TOKEN="$(printf '%s' "$TOKEN" | tr -d '[:space:]')"

    if [[ -n "$TOKEN" ]]; then
      [[ "$TOKEN" == sbp_* ]] || die "אסימון אישי של Supabase מתחיל ב-sbp_" \
          "" "התקבלו ${#TOKEN} תווים שלא מתחילים כך."
      export SUPABASE_ACCESS_TOKEN="$TOKEN"
      sees_project || die "גם עם האסימון הזה הפרויקט $PROJECT_REF לא נראה" \
          "" \
          "האסימון תקף, אבל הוא של חשבון שאינו חבר בארגון של הפרויקט." \
          "צרו אותו מתוך החשבון שאיתו נכנסתם ל-$PROJECT_REF בדפדפן."
      printf '   הפרויקט נראה. ממשיך.\n' >&2
    fi
  fi
fi

if ! sees_project; then
  die "אין גישה לפרויקט $PROJECT_REF, מדלג על הפריסה" \
      "" \
      "כל השאר כבר מוכן — רק שתי הפונקציות לא נפרסו." \
      "אפשר לפרוס אותן ידנית מלוח הבקרה:" \
      "Edge Functions → Deploy a new function, והקוד ב-supabase/functions/." \
      "" \
      "או להריץ שוב עם אסימון של החשבון הנכון:" \
      "   SUPABASE_ACCESS_TOKEN='sbp_...' npm run setup:supabase"
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

# ── האם הפריסה באמת תפסה? ────────────────────────────────────────────────
# "הרצתי את הסקריפט והכל ירוק, והאתר עדיין מתנהג כמו מול שרת ישן" קרה
# בפועל, ולקח ימים לאתר. הפקודה מסתיימת בהצלחה, ולכן הצלחה שלה אינה
# עדות. העדות היחידה היא לשאול את הפונקציה החיה מה היא מכירה.
step "מוודא שהפריסה תפסה"
CHECK_URL="${VITE_SUPABASE_URL:-https://$PROJECT_REF.supabase.co}"
CHECK_KEY="${VITE_SUPABASE_ANON_KEY:-}"
if [[ -z "$CHECK_KEY" && -f .env.production ]]; then
  CHECK_KEY="$(sed -n 's/^VITE_SUPABASE_ANON_KEY=//p' .env.production | head -1)"
fi
if [[ -z "$CHECK_KEY" ]]; then
  # שער ה-Edge Functions דורש JWT תקין עוד לפני הקוד שלנו, ולכן גם
  # שאלת גרסה צריכה את מפתח ה-anon. הוא ממילא ציבורי, וה-CLI כבר מזוהה.
  CHECK_KEY="$("${SUPA[@]}" projects api-keys --project-ref "$PROJECT_REF" -o json 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
        try{const a=JSON.parse(s);const k=a.find(x=>(x.name??x.key_name)==="anon");
        process.stdout.write(k?.api_key??k?.apiKey??"");}catch{}})' || true)"
fi

if [[ -n "$CHECK_KEY" ]]; then
  VITE_SUPABASE_URL="$CHECK_URL" VITE_SUPABASE_ANON_KEY="$CHECK_KEY" \
    node scripts/check-server.mjs \
    || die "הפריסה הסתיימה, אבל השרת עדיין מחזיר גרסה ישנה" \
        "" \
        "הפקודה supabase functions deploy סיימה בהצלחה — ולמרות זאת" \
        "הפונקציה שעונה בכתובת היא לא זו שנפרסה עכשיו." \
        "" \
        "כמעט תמיד אחד משניים:" \
        "• הקוד כאן ישן. git status ו-git pull, ואז שוב." \
        "• יש שני פרויקטי Supabase, והאתר פונה לאחר. השוו את" \
        "  VITE_SUPABASE_URL באתר מול https://$PROJECT_REF.supabase.co"
else
  printf '   \033[33m⚠ אין מפתח anon כאן, ולכן לא ניתן לוודא מרחוק.\033[0m\n' >&2
  printf '     אחרי שתגדירו .env.production הריצו: npm run check:server\n' >&2
fi

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
