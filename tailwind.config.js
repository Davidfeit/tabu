/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Heebo", "Assistant", "Noto Sans Hebrew", "Arial Hebrew", "system-ui", "sans-serif"],
        // עגול ככל שעברית מאפשרת. Varela Round הוא כמעט הפונט העברי
        // היחיד שבאמת עגול, וזה מה שנותן את הרושם הילדותי.
        display: ["Varela Round", "Heebo", "sans-serif"],
        logo: ["Secular One", "Varela Round", "sans-serif"],
      },
      colors: {
        // הלוח נשאר כמו שהוא — הצבעים האלה שלו, ואין לגעת בהם.
        felt: { DEFAULT: "#0d5c4a", dark: "#0a4638", light: "#12705a" },
        parchment: { DEFAULT: "#f5f0e4", dim: "#e8e0cd" },
        // כל השאר: צעצוע. דיו כהה-סגלגל על משטחים בהירים, וצבעי סוכריות.
        ink: { DEFAULT: "#2f2450", soft: "#6a5f8c" },
        toy: {
          sky: "#7fd4ff", deep: "#2f8fd8", cream: "#fffdf7",
          sun: "#ffc23c", candy: "#ff6f6f", grass: "#5ecf7a",
          grape: "#9b6dff", edge: "#d9cbf5",
        },
      },
    },
  },
  plugins: [],
};
