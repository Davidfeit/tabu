# העלאה לאוויר

שתי החלטות: **איפה מארחים את האתר**, ו**האם רוצים וידאו בין אנשים**.

התשובה השנייה קובעת את הראשונה יותר משנדמה — מצלמה עובדת רק ב-https,
בעמוד עליון (לא בתוך מסגרת מוטמעת).

---

## חלק א' — האתר

### אפשרות 1: פרויקט Vercel עצמאי (מומלץ)

המשחק נשאר מופרד לגמרי מפלטפורמת עינית, ומקבל כתובת משלו.

1. [vercel.com/new](https://vercel.com/new) → יבוא של `Davidfeit/einit-platform`
2. **Root Directory: `tabu`** ← זה הצעד היחיד שקל לפספס
3. Framework מזוהה אוטומטית (Vite). `tabu/vercel.json` כבר מגדיר הכל,
   כולל את כותרת `Permissions-Policy` שמתירה מצלמה.
4. Deploy

זהו. הכתובת תהיה משהו כמו `https://tabu.vercel.app`.

### אפשרות 2: תת-נתיב בפלטפורמה הקיימת

בלי שום קליק בלוח הבקרה — המשחק נבנה יחד עם `web/` ומוגש מ-
`https://einit-platform.vercel.app/tabu/`. דורש שינוי ב-`vercel.json`
בשורש (ראה `docs/deploy-subpath.md`).

חיסרון: המשחק חי על אותו דומיין כמו הכלים העסקיים.

### מה *לא* עובד

- **GitHub Pages** — הריפו פרטי, וזה דורש מנוי בתשלום.
- **פתיחת הקובץ מהדיסק** (`file://`) — לא הקשר מאובטח, אין מצלמה.
- **תצוגה מוטמעת במסגרת** — Permissions Policy חוסמת מצלמה.
  האפליקציה מזהה זאת ואומרת זאת במפורש.

---

## חלק ב' — וידאו בין אנשים

בלי צד שרת, האתר נותן משחק מקומי מלא ומצלמה שלכם. **וידאו בין
מכשירים דורש ערוץ סיגנלינג**, וזה מה ש-Supabase נותן.

### 1. פרויקט Supabase

[supabase.com](https://supabase.com) → פרויקט חדש, אזור
**eu-central-1 (פרנקפורט)** — הקרוב ביותר לישראל, ~50–65ms.

### 2. פקודה אחת

```bash
cd tabu
export PGURL='postgres://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres'
export PROJECT_REF='[REF]'
npm run setup:supabase
```

הסקריפט מחיל את הסכימה, מריץ את **הבדיקה החוסמת** (ראה למטה), ופורס את
שתי ה-Edge Functions.

### 3. ארבעה מתגים בלוח הבקרה

| איפה | מה |
|---|---|
| Authentication → Providers | **Anonymous sign-ins: הפעילו** |
| Realtime → Settings | **"Allow public access": כבו** |
| Edge Functions → Secrets | `ALLOWED_ORIGIN` = כתובת האתר |
| Settings → API | העתיקו `URL` ו-`anon key` |

### 4. שני משתני סביבה בפרויקט האתר

```
VITE_SUPABASE_URL      = https://[REF].supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOi...
```

ב-Vercel: Settings → Environment Variables, ואז Redeploy.

מרגע זה כפתור "משחק אונליין עם וידאו" נדלק.

---

## הבדיקה החוסמת

כל הארכיטקטורה נשענת על הנחה **שהתיעוד של Supabase לא אומר במפורש**:
ש-`realtime.send()` בתוך טרנזקציה הוא אטומי איתה. אם ההנחה שגויה, שידור
יכול להצליח בזמן שהמהלך נכשל — וכל הלקוחות ייתקעו על מצב שלא קיים.

`npm run setup:supabase` מריץ אותה אוטומטית ומדפיס אזהרה אם היא נכשלה.
להרצה ידנית ב-SQL Editor:

```sql
begin;
select public.tabu_broadcast('room:00000000-0000-0000-0000-000000000000',
                             'probe', '{"probe":true}'::jsonb);
rollback;
```

**אף לקוח מנוי לא אמור לקבל דבר.** אם כן — יש להוציא את השידור
מ-`commit_move` ולקרוא לו מה-Edge Function *אחרי* התחייבות מוצלחת.
הלקוחות מתקנים פער כזה ממילא ברענון לפי גרסה, אז המחיר הוא עיכוב ולא
שגיאה.

---

## TURN — למי שמאחורי NAT סימטרי

בלי TURN, כ-10–20% מהחיבורים ייכשלו, ובישראל להניח את הקצה העליון בגלל
CGNAT בסלולר. Cloudflare Realtime TURN: **1,000GB חינם בחודש**,
‎$0.05/GB אחר כך, ו-PoP בתל אביב.

Dashboard → Realtime → TURN → מפתח חדש, ואז ב-Supabase Secrets:
`TURN_KEY_ID` ו-`TURN_KEY_API_TOKEN`.

> תועדו תקריות של ניתוב שגוי של תעבורת בזק/HOT ל-PoP אירופי. כדאי למדוד
> RTT אמיתי מהספקים הישראליים לפני שמניחים קרבה לתל אביב.

---

## עלות

| | חינם | מתי מתחילים לשלם |
|---|---|---|
| Vercel Hobby | ✅ | לא, בקנה מידה הזה |
| Supabase Free | ✅ | 200 חיבורים במקביל, 2M הודעות בחודש |
| Cloudflare TURN | ✅ | מעל 1,000GB בחודש |

**פרויקט Supabase חינמי נכבה אחרי ~שבוע חוסר פעילות.** פינג יומי פותר —
למשל GitHub Action שקורא ל-`/rest/v1/`.

בגישת הערוץ-פר-שחקן (ראה `src/net/signaling.ts`), 2M ההודעות מספיקות
ל-~26,000 הקמות חדר בחודש. משחק שלם הוא ~2,800 הודעות שידור.
