/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F6F1E7",
        ink: "#1C2B27",
        teal: {
          DEFAULT: "#0F6C5B",
          dark: "#0B5346",
          light: "#E4F3EF",
        },
        coral: "#E85D4C",
        gold: "#E6B325",
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 12px 40px rgba(15, 45, 38, 0.08)",
      },
    },
  },
  plugins: [],
};
