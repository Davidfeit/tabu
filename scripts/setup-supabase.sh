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
cd "$(dirname "$0")/.."

# ── אימות קלט ────────────────────────────────────────────────────────────
# בלי הבדיקות האלה, placeholder שנשאר במקומו מגיע עד כשל DNS עמום.

die() { printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2; shift; for l in "$@"; do printf '   %s\n' "$l" >&2; done; exit 1; }

# אם לא הוגדר PGURL ויש טרמינל, פשוט מבקשים אותו. הדבקה של מחרוזת ארוכה
# לשורת הפקודה נשברת לשורות ומתפרשת כפקודה; קריאה כאן חסינה לשתי התקלות.
if [[ -z "${PGURL:-}" && -t 0 ]]; then
  cat <<'ASK'

   דרוש חיבור לבסיס הנתונים של Supabase.

   Project Settings → Database → Connection string → לשונית Session pooler
   (לא Direct connection — למארח שלו יש רשומת IPv6 בלבד)

   החליפו [YOUR-PASSWORD] בסיסמה, והדביקו כאן את המחרוזת המלאה.
   היא לא תוצג על המסך.

ASK
  printf '   מחרוזת חיבור: '
  IFS= read -rs PGURL || true
  printf '\n'
fi

# מנקים את מה שהודבק: רווחים ושורות שנשברו באמצע ההדבקה, גרשיים עוטפים,
# ו-"export PGURL=" שהועתק יחד עם הערך. בכתובת תקינה אין רווחים בכלל.
if [[ -n "${PGURL:-}" ]]; then
  PGURL="$(printf '%s' "$PGURL" | tr -d '[:space:]')"
  PGURL="${PGURL#export}"
  PGURL="${PGURL#PGURL=}"
  PGURL="${PGURL#\'}"; PGURL="${PGURL%\'}"
  PGURL="${PGURL#\"}"; PGURL="${PGURL%\"}"
fi

if [[ -z "${PGURL:-}" ]]; then
  die "חסר PGURL — כתובת החיבור לבסיס הנתונים" \
      "" \
      "1. צרו פרויקט ב-supabase.com (אזור eu-central-1, פרנקפורט)" \
      "2. Project Settings → Database → Connection string → URI" \
      "3. החליפו [YOUR-PASSWORD] בסיסמה שבחרתם ביצירת הפרויקט" \
      "" \
      "   export PGURL='postgresql://postgres:הסיסמה@db.abcdefgh.supabase.co:5432/postgres'"
fi

if [[ "$PGURL" == *"["*"]"* ]]; then
  die "PGURL עדיין מכיל placeholder בסוגריים מרובעים" \
      "" \
      "קיבלתי: $PGURL" \
      "" \
      "צריך להחליף את מה שבסוגריים בערכים האמיתיים מלוח הבקרה של Supabase." \
      "[YOUR-PASSWORD] או [PASSWORD] = הסיסמה שבחרתם ביצירת הפרויקט." \
      "[REF] = מזהה הפרויקט, המחרוזת באורך ~20 תווים בכתובת." \
      "אם שכחתם את הסיסמה: Settings → Database → Reset database password."
fi

# מזהה הפרויקט נגזר מהכתובת, כדי שלא יהיה עוד משתנה להדביק.
if [[ -z "${PROJECT_REF:-}" ]]; then
  if [[ "$PGURL" =~ db\.([a-z0-9]+)\.supabase\.co ]]; then
    PROJECT_REF="${BASH_REMATCH[1]}"
  elif [[ "$PGURL" =~ postgres\.([a-z0-9]+)[:@] ]]; then
    # מחרוזת מה-pooler: postgres.<ref>:<password>@aws-0-<region>.pooler...
    # הסיסמה יושבת בין המזהה ל-@, ולכן צריך גם ":" ולא רק "@".
    PROJECT_REF="${BASH_REMATCH[1]}"
  elif [[ "$PGURL" == *pooler.supabase.com* ]]; then
    # מארח pooler עם שם המשתמש "postgres" — סימן שערכו את המחרוזת ידנית.
    die "מחרוזת ה-pooler חסרה את מזהה הפרויקט בשם המשתמש" \
        "" \
        "ב-Session pooler שם המשתמש הוא postgres.<ref>, לא postgres —" \
        "ה-pooler מזהה לפיו לאיזה פרויקט לנתב." \
        "" \
        "העתיקו את המחרוזת המלאה מלשונית Session pooler בלי לערוך אותה."
  else
    die "לא הצלחתי לגזור את PROJECT_REF מ-PGURL" \
        "" \
        "הגדירו אותו ידנית:  export PROJECT_REF='abcdefgh...'"
  fi
  printf '   מזהה פרויקט: %s\n' "$PROJECT_REF"
fi

if ! command -v psql >/dev/null 2>&1; then
  die "psql לא מותקן" "" "ב-macOS:  brew install libpq && brew link --force libpq"
fi

# מפרקים את הכתובת כדי שהאבחון יוכל להצביע על מה בדיוק נכשל.
# הסיסמה לא נקראת ולא מודפסת בשום שלב.
PG_USER="$(printf '%s' "$PGURL" | sed -E 's#^postgres(ql)?://([^:@/]+).*#\2#')"
PG_HOSTPORT="$(printf '%s' "$PGURL" | sed -E 's#^[^@]*@##; s#[/?].*##')"
PG_HOST="${PG_HOSTPORT%%:*}"
PG_PORT="${PG_HOSTPORT##*:}"
if [[ "$PG_PORT" == "$PG_HOST" ]]; then PG_PORT=5432; fi

printf '\n→ בודק חיבור אל %s:%s בתור %s\n' "$PG_HOST" "$PG_PORT" "$PG_USER"

# תקלה נפוצה: לוקחים את מארח ה-pooler אבל משאירים את שם המשתמש "postgres".
# ה-pooler מזהה את הפרויקט לפי שם המשתמש, ולכן הוא חייב להיות postgres.<ref>.
if [[ "$PG_HOST" == *pooler.supabase.com && "$PG_USER" != postgres.* ]]; then
  die "שם המשתמש לא מתאים למחרוזת ה-pooler" \
      "" \
      "המארח הוא $PG_HOST, אבל שם המשתמש הוא \"$PG_USER\"." \
      "ה-pooler מזהה את הפרויקט לפי שם המשתמש, ולכן הוא חייב להיות:" \
      "" \
      "   postgres.$PROJECT_REF" \
      "" \
      "העתיקו את המחרוזת המלאה מלשונית Session pooler בלי לערוך אותה."
fi

# ולהפך: פורט 6543 הוא transaction mode, ששובר DDL וטרנזקציות מרובות-משפטים.
if [[ "$PG_HOST" == *pooler.supabase.com && "$PG_PORT" == 6543 ]]; then
  die "זו מחרוזת ה-Transaction pooler (פורט 6543)" \
      "" \
      "הסקריפט מריץ DDL וטרנזקציות מרובות-משפטים, ומצב transaction שובר אותן." \
      "קחו את המחרוזת מלשונית Session pooler — אותו מארח, פורט 5432."
fi

export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-10}"
if ! PG_ERR="$(psql "$PGURL" -tAc 'select 1' 2>&1 >/dev/null)"; then
  # psql משקף את הכתובת בחלק מהשגיאות — מסתירים את הסיסמה לפני ההדפסה.
  PG_ERR="$(printf '%s' "$PG_ERR" | sed -E 's#(postgres(ql)?://[^:]+:)[^@]*@#\1***@#g')"
  # לפעמים psql נכשל בפענוח שם ומדפיס כותרת ריקה בלי סיבה. אל תציגו "psql: error:" לבד.
  PG_ERR_BODY="${PG_ERR//psql: error:/}"
  if [[ -z "${PG_ERR_BODY//[[:space:]]/}" ]]; then
    PG_ERR="(psql לא פירט — כמעט תמיד כשל בפענוח שם המארח או חוסר מסלול אליו)"
  fi

  # מארח ה-Direct connection של Supabase הוא IPv6 בלבד. ברשת ביתית ישראלית
  # טיפוסית אין IPv6, ולכן כל כשל עליו מוביל לאותה עצה.
  direct_hint=()
  if [[ "$PG_HOST" == db.*.supabase.co ]]; then
    direct_hint=(""
      "שימו לב: $PG_HOST הוא מארח Direct connection, ול-Supabase יש עליו"
      "רשומת IPv6 בלבד. ברוב הרשתות הביתיות בישראל אין IPv6, ולכן הוא לא יעבוד."
      ""
      "קחו במקומו: Settings → Database → Connection string → לשונית Session pooler"
      "   postgresql://postgres.$PROJECT_REF:הסיסמה@aws-0-<אזור>.pooler.supabase.com:5432/postgres")
  fi

  hint=()
  case "$PG_ERR" in
    *"password authentication failed"*|*"Tenant or user not found"*)
      hint=("הסיסמה או שם המשתמש שגויים."
            "איפוס: Settings → Database → Reset database password."
            "אם יש בסיסמה אחד מהתווים @ : / ? # %, היא חייבת להיות מקודדת-URL בתוך הכתובת.") ;;
    *"could not translate host name"*|*"Name or service not known"*|*"nodename nor servname"*)
      hint=("שם המארח לא נפתר — ודאו שהכתובת הועתקה במלואה ושהפרויקט עדיין קיים.") ;;
    *"Network is unreachable"*|*"No route to host"*|*"timeout expired"*|*"Connection timed out"*|*"Operation timed out"*)
      if [[ "$PG_HOST" == *pooler.supabase.com ]]; then
        # ל-pooler יש IPv4, ולכן חוסר מסלול אליו הוא כבר לא שאלה של IPv6.
        hint=("הכתובת נפתרה אבל החיבור לא נענה."
              "למארח ה-pooler יש IPv4, ולכן זו כנראה חסימה של פורט $PG_PORT היוצא"
              "ברשת שלכם — נפוץ ברשתות משרדיות וב-VPN. נסו מרשת אחרת, למשל"
              "שיתוף אינטרנט מהטלפון. ובדקו שהפרויקט לא במצב Paused.")
      else
        hint=("הכתובת נפתרה אבל אין מסלול אליה."
              "זה בדיוק התסמין של מארח IPv6-only מרשת בלי IPv6 — או של פורט $PG_PORT חסום.")
      fi ;;
    *"Connection refused"*)
      hint=("השרת דחה את החיבור בפורט $PG_PORT."
            "אם זו מחרוזת Direct connection — נסו את ה-Session pooler.") ;;
    *)
      hint=("• הפרויקט לא במצב Paused (פרויקט חינמי נכבה אחרי ~שבוע חוסר פעילות)"
            "• הסיסמה נכונה (Settings → Database → Reset database password)"
            "• אם אין לכם IPv6, השתמשו במחרוזת ה-Session pooler") ;;
  esac
  die "אין חיבור לבסיס הנתונים" "" "psql החזיר:" "   $PG_ERR" "" "${hint[@]}" "${direct_hint[@]}"
fi
printf '   מחובר\n'

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
