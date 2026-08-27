#!/usr/bin/env bash
#
# בודק את .env.production לפני שדוחפים אותו.
#
#   npm run check:env
#
# הערכים האלה נכנסים לבנייה, ובנייה עם ערך שבור נראית תקינה לגמרי ונכשלת
# רק כשמנסים לשחק. שתי התקלות שקרו בפועל: placeholder שלא הוחלף, והדבקה
# של מפתח ארוך שנשברה לשתי שורות.
set -uo pipefail
cd "$(dirname "$0")/.."
F="${1:-.env.production}"

fail() { printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2; shift; for l in "$@"; do printf '   %s\n' "$l" >&2; done; exit 1; }

[[ -f "$F" ]] || fail "$F לא קיים" "" "אפשר גם להגדיר את המשתנים בלוח הבקרה של Vercel במקום."

n="$(grep -c . "$F")"
[[ "$n" == 2 ]] || fail "$F מכיל $n שורות לא ריקות במקום 2" \
  "" "כמעט תמיד: הדבקה של מפתח ארוך שנשברה לשורה חדשה." \
  "פתחו את הקובץ וודאו ששני הערכים יושבים כל אחד בשורה אחת."

url="$(sed -n 's/^VITE_SUPABASE_URL=//p' "$F" | head -1)"
key="$(sed -n 's/^VITE_SUPABASE_ANON_KEY=//p' "$F" | head -1)"

[[ "$url" =~ ^https://[a-z0-9]{20}\.supabase\.co/?$ ]] || fail \
  "VITE_SUPABASE_URL אינו כתובת פרויקט תקינה" "" "התקבל: ${url:-(ריק)}" \
  "אמור להיראות כך: https://abcdefghijklmnopqrst.supabase.co"

# מפתח anon הוא JWT. placeholder ("המפתח_שלכם", "eyJhbGciOi...") נופל כאן.
[[ "$key" =~ ^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$ ]] || fail \
  "VITE_SUPABASE_ANON_KEY אינו מפתח anon תקין" "" "התקבל: ${key:-(ריק)}" \
  "מפתח anon הוא JWT: מתחיל ב-ey, שלושה חלקים מופרדים בנקודות." \
  "Project Settings → API → Project API keys → anon / public"

printf '\n\033[32m✓ %s תקין\033[0m\n' "$F"
printf '   כתובת: %s\n' "$url"
printf '   מפתח:  %s… (%s תווים)\n' "${key:0:12}" "${#key}"
