/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['selector', '[data-tema="oscuro"]'],
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
