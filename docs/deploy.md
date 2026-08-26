# פריסה

שני שירותים, שניהם בשכבה חינמית: **Supabase** (בסיס נתונים, הזדהות,
Realtime, Edge Functions) ו**כל אחסון סטטי** לחזית (Vercel, Netlify,
Cloudflare Pages). אופציונלי: **Cloudflare TURN**.

בקנה מידה של חדרים פרטיים בין חברים העלות היא **₪0**.

---

## 1. Supabase

צרו פרויקט חדש באזור **eu-central-1 (פרנקפורט)** — הקרוב ביותר לישראל, ~50–65ms.

### הסכימה

```bash
export PGURL='postgres://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres'
psql "$PGURL" -v ON_ERROR_STOP=1 -f db/001_schema.sql
psql "$PGURL" -v ON_ERROR_STOP=1 -f db/002_commit_move.sql
psql "$PGURL" -v ON_ERROR_STOP=1 -f db/003_rls.sql
```

> **אל תריצו את `db/000_local_bootstrap.sql`** — הוא מייצר מקומית את התפקידים
> ואת `auth.uid()` ש-Supabase כבר מספקת.

### הזדהות אנונימית

Authentication → Providers → **Anonymous Sign-ins: enabled**.
זה כל מה שנדרש: חדרים פרטיים בלינק, בלי מיילים ובלי סיסמאות.

### Realtime

Realtime Settings → **בטלו את "Allow public access"**.
`db/003_rls.sql` כבר יצר את המדיניות על `realtime.messages` שמאפשרת לקרוא
שידורים רק לחברי החדר.

### Edge Functions

```bash
npm run build:engine        # חובה — מקבץ את המנוע ל-Deno
npx supabase functions deploy play
npx supabase functions deploy ice
```

Secrets (Edge Functions → Secrets):

| שם | ערך |
|---|---|
| `ALLOWED_ORIGIN` | כתובת האתר, למשל `https://tabu.example.com` |
| `TURN_KEY_ID` | מ-Cloudflare, אופציונלי |
| `TURN_KEY_API_TOKEN` | מ-Cloudflare, אופציונלי |

`SUPABASE_URL` ו-`SUPABASE_SERVICE_ROLE_KEY` מוזרקות אוטומטית.

---

## 2. ⚠️ בדיקה חוסמת לפני שמשחקים באמת

כל הארכיטקטורה נשענת על הנחה **שהתיעוד של Supabase לא אומר במפורש**:
ש-`realtime.send()` בתוך טרנזקציה הוא אטומי איתה. אם ההנחה שגויה, שידור
יכול להצליח בזמן שהמהלך נכשל — וכל הלקוחות ייתקעו על מצב שאינו קיים.

הריצו זאת ב-SQL Editor, כשלקוח מנוי לערוץ `room:...`:

```sql
begin;
select public.tabu_broadcast('room:00000000-0000-0000-0000-000000000000',
                             'move', '{"probe":true}'::jsonb);
rollback;
```

**אף לקוח לא אמור לקבל דבר.** אם כן — יש להוציא את השידור מ-`commit_move`
ולהעביר אותו לקריאה נפרדת ב-Edge Function *אחרי* התחייבות מוצלחת, ולקבל
את הפער האפשרי בין השניים (הלקוחות מתקנים אותו ממילא ברענון לפי גרסה).

---

## 3. החזית

```bash
npm ci && npm run build      # מייצר dist/
```

משתני סביבה: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

האתר סטטי לגמרי. כל אחסון סטטי מתאים; אין צורך ב-SSR.

---

## 4. TURN (אופציונלי, ומומלץ)

בלי TURN, כ-10–20% מהחיבורים ייכשלו — ובישראל להניח את הקצה העליון בגלל
CGNAT בסלולר. Cloudflare Realtime TURN: **1,000GB חינם בחודש**, ‎$0.05/GB
אחר כך, ו-PoP בתל אביב.

Cloudflare Dashboard → Realtime → TURN → צרו מפתח, והזינו את `TURN_KEY_ID`
ו-`TURN_KEY_API_TOKEN` ב-Secrets.

> תועדו תקריות של ניתוב שגוי של תעבורת בזק/HOT ל-PoP אירופי. כדאי למדוד
> RTT אמיתי מהספקים הישראליים לפני שמניחים קרבה לתל אביב.

---

## 5. שכבה חינמית — מה כדאי לדעת

- **פרויקט Supabase חינמי נכבה אחרי ~שבוע חוסר פעילות.** פינג יומי פותר
  (למשל GitHub Action שקורא `/rest/v1/`).
- 200 חיבורי Realtime במקביל ו-2M הודעות בחודש. בגישת הערוץ-פר-שחקן
  (ראה `src/net/signaling.ts`) זה ~26,000 הקמות חדר.
- משחק שלם הוא ~2,800 הודעות שידור, כלומר ~700 משחקים בחודש בחינם.
