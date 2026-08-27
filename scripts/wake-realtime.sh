#!/usr/bin/env bash
#
# מעיר את שירות ה-Realtime של הפרויקט ובודק אם המחיצות נוצרו.
#
#   npm run fix:realtime
#
# הרקע: שירות ה-Realtime הוא שיוצר את המחיצות של realtime.messages, והוא
# לא רץ לפרויקט שאיש מעולם לא התחבר אליו. הסקריפט מחבר לקוח אחד, ואז
# מריץ שוב את בדיקת השידור כדי לראות אם זה הספיק.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."
. "$SCRIPT_DIR/lib/pgurl.sh"
require_project_ref

SUPABASE_URL="${VITE_SUPABASE_URL:-https://$PROJECT_REF.supabase.co}"

if [[ -z "${SUPABASE_ANON_KEY:-${VITE_SUPABASE_ANON_KEY:-}}" ]]; then
  cat <<ASK

   דרוש מפתח anon של הפרויקט.

   Project Settings → API → Project API keys → anon / public
   (זה מפתח ציבורי — הוא ממילא מוטמע בדפדפן של כל שחקן)

ASK
  printf '   מפתח anon: '
  IFS= read -r SUPABASE_ANON_KEY || true
  printf '\n'
fi
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-${VITE_SUPABASE_ANON_KEY:-}}"
SUPABASE_ANON_KEY="$(printf '%s' "$SUPABASE_ANON_KEY" | tr -d '[:space:]')"
[[ -n "$SUPABASE_ANON_KEY" ]] || die "לא התקבל מפתח anon"

# מפתח anon הוא JWT: שלושה חלקים מופרדים בנקודות. הבדיקה תופסת הדבקה
# שנקטעה בשורה חדשה — read עוצר בה, והשארית הולכת לאיבוד בלי סימן.
if [[ "$SUPABASE_ANON_KEY" != ey*.*.* ]]; then
  die "המפתח לא נראה כמו מפתח anon תקין" \
      "" \
      "התקבלו ${#SUPABASE_ANON_KEY} תווים, ומפתח anon הוא JWT שמתחיל ב-\"ey\"" \
      "ומורכב משלושה חלקים מופרדים בנקודות." \
      "" \
      "אם ההדבקה נקטעה, אפשר גם להעביר אותו כמשתנה סביבה:" \
      "   SUPABASE_ANON_KEY='...' npm run fix:realtime"
fi
export SUPABASE_URL SUPABASE_ANON_KEY

[[ -d node_modules/@supabase ]] || npm install --no-audit --no-fund

printf '\n\033[1m→ מתחבר ל-Realtime (%s)\033[0m\n' "$SUPABASE_URL"
node scripts/wake-realtime.mjs

printf '\n\033[1m→ בודק שוב אם השידור נשמר\033[0m\n'
PROBE="$(psql "$PGURL" -q -v ON_ERROR_STOP=1 -tA -f db/probe_broadcast.sql \
         | tail -n1 | tr -d '[:space:]')"
case "$PROBE" in
  ok)
    printf '   השידור נשמר — המחיצות נוצרו. אין צורך בעקיפה.\n' ;;
  not_stored)
    printf '\n' >&2
    psql "$PGURL" -q -tA -f db/probe_broadcast_diag.sql 2>/dev/null | sed 's/^/      /' >&2
    cat >&2 <<'NEXT'

   ⚠ החיבור לא הספיק — עדיין אין מחיצות.

   זו הנקודה שבה העקיפה מוצדקת:

       npm run fix:realtime-partitions

NEXT
    exit 1 ;;
  *)
    printf '   תוצאה: %s\n' "$PROBE" ;;
esac
