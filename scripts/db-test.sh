#!/usr/bin/env bash
# מריץ את סכימת טאבו ואת בדיקות שכבת ההתחייבות מול Postgres.
#
#   scripts/db-test.sh                      # משתמש ב-PGHOST/PGPORT/PGUSER
#   PGURL=postgres://... scripts/db-test.sh # או מול Supabase
set -euo pipefail
cd "$(dirname "$0")/.."

PSQL=(psql -v ON_ERROR_STOP=1 -q)
if [[ -n "${PGURL:-}" ]]; then PSQL+=("$PGURL")
else PSQL+=(-h "${PGHOST:-/tmp}" -p "${PGPORT:-5433}" -U "${PGUSER:-postgres}")
fi

if [[ -z "${PGURL:-}" ]]; then
  echo "→ bootstrap מקומי (תפקידים ו-auth.uid של Supabase)"
  "${PSQL[@]}" -f db/000_local_bootstrap.sql
fi

echo "→ מחיל סכימה"
"${PSQL[@]}" -f db/001_schema.sql
"${PSQL[@]}" -f db/002_commit_move.sql
"${PSQL[@]}" -f db/003_rls.sql
"${PSQL[@]}" -f db/004_realtime_partitions.sql

echo "→ בדיקות שכבת ההתחייבות"
"${PSQL[@]}" -f db/test/commit_move.sql

echo "→ בדיקת מרוץ: שני כותבים מקבילים על אותה גרסה"
"${PSQL[@]}" -f db/test/concurrency_setup.sql
for i in 1 2; do
  "${PSQL[@]}" -c "select commit_move(
      'aaaaaaaa-0000-0000-0000-000000000001', 0,
      jsonb_build_object('phase','awaiting_end','currentSeat',0,
                         'turnDeadline',null,'writer',$i),
      '[]'::jsonb, 'bbbbbbbb-0000-0000-0000-00000000000$i',
      gen_random_uuid());" >/dev/null 2>&1 &
done
wait
"${PSQL[@]}" -f db/test/concurrency_check.sql
"${PSQL[@]}" -c "delete from game_rooms where id = 'aaaaaaaa-0000-0000-0000-000000000001';" >/dev/null

echo "→ בדיקות RLS"
"${PSQL[@]}" -f db/test/rls.sql

echo "✓ כל בדיקות ה-DB עברו"
