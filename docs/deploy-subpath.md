# העלאה כתת-נתיב בפלטפורמה הקיימת

חלופה ל[פרויקט Vercel עצמאי](deploy.md). היתרון: אפס קליקים בלוח בקרה —
המשחק עולה יחד עם הפלטפורמה בכל מיזוג ל-`main`. החיסרון: הוא חי על
אותו דומיין כמו הכלים העסקיים.

## מה משתנה ב-`vercel.json` שבשורש

```jsonc
{
  // בונים גם את המשחק, ומעתיקים אותו לתוך פלט הבנייה של web/
  "buildCommand":
    "cd web && npm install && npm run build && cd ../tabu && npm ci && VITE_BASE=/tabu/ npm run build && mkdir -p ../web/dist/tabu && cp -r dist/* ../web/dist/tabu/",

  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index" },
    // חשוב: החרגה של /tabu לפני ה-catch-all, אחרת הוא נבלע ל-SPA של עינית
    { "source": "/tabu/(.*)", "destination": "/tabu/$1" },
    { "source": "/((?!api/|tabu/).*)", "destination": "/index.html" }
  ],

  "headers": [
    {
      "source": "/tabu/(.*)",
      "headers": [
        { "key": "Permissions-Policy", "value": "camera=(self), microphone=(self)" }
      ]
    }
  ]
}
```

`VITE_BASE=/tabu/` הוא הקריטי: בלעדיו הנכסים נטענים מהשורש והעמוד
מרונדר ריק בלי שום שגיאה גלויה.

## מה שצריך לזכור

- זמן הבנייה של הפלטפורמה גדל בכ-20 שניות.
- כשל בבניית המשחק מפיל את פריסת הפלטפורמה כולה. זו הסיבה העיקרית
  להעדיף פרויקט נפרד.
- `Permissions-Policy` חייבת להיות מוגדרת על הנתיב, אחרת המצלמה חסומה.
