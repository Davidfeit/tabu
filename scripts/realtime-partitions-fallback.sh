#!/usr/bin/env bash
#
# עקיפה למקרה שבו שידורי ה-DB לא נשמרים כי אין מחיצה ל-realtime.messages
# ולתפקיד אין CREATE על סכימת realtime.
#
# ⚠ הריצו רק אחרי ש-npm run setup:supabase דיווח not_stored *וגם* אחרי
#   שלקוח כבר התחבר ל-Realtime לפחות פעם אחת. ראו db/005 להסבר ולביטול.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."
. "$SCRIPT_DIR/lib/pgurl.sh"

printf '\n\033[1m→ מצרף מחיצות ל-realtime.messages\033[0m\n'
psql "$PGURL" -v ON_ERROR_STOP=1 -q -f db/005_attach_partitions_fallback.sql

printf '\n\033[1m→ בודק שוב אם השידור נשמר\033[0m\n'
PROBE="$(psql "$PGURL" -q -v ON_ERROR_STOP=1 -tA -f db/probe_broadcast.sql \
         | tail -n1 | tr -d '[:space:]')"
case "$PROBE" in
  ok) printf '   השידור נשמר, ומתבטל יחד עם הטרנזקציה\n' ;;
  not_stored)
    die "השידור עדיין לא נשמר" \
        "" \
        "העקיפה לא פתרה, ולכן הסיבה אינה המחיצות. פתחו תקלה מול Supabase" \
        "וצרפו את פלט האבחון:" \
        "" \
        "   psql \"\$PGURL\" -f db/probe_broadcast_diag.sql" ;;
  *) printf '   תוצאה: %s\n' "$PROBE" ;;
esac
