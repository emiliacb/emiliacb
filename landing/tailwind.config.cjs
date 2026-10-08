/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "media",
  content: ["./src/site/**/*.{html,ts}", "./src/client/**/*.{js,ts}", "./src/shared/**/*.ts"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Montserrat", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
