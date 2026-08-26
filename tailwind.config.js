/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Heebo", "Assistant", "Noto Sans Hebrew", "Arial Hebrew", "system-ui", "sans-serif"],
        display: ["Rubik", "Heebo", "sans-serif"],
        logo: ["Secular One", "Rubik", "sans-serif"],
      },
      colors: {
        felt: { DEFAULT: "#0d5c4a", dark: "#0a4638", light: "#12705a" },
        parchment: { DEFAULT: "#f5f0e4", dim: "#e8e0cd" },
      },
    },
  },
  plugins: [],
};
