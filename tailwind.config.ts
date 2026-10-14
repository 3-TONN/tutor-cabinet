import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

// Мир «Кодовая таблица»: бумага, чистый чёрный, ультрамарин для выделения и главного действия,
// сигнальный красный только для долгов и просрочек. Токены переключаются темой через CSS-переменные (globals.css).
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

// Старые цветовые классы сводятся к нейтральной шкале, красный — только как сигнал.
const neutral = colors.neutral;
const signal = {
  50: "#fef3f2", 100: "#fee4e2", 200: "#fecdca", 300: "#fda29b", 400: "#f97066",
  500: "#f04438", 600: "#d92d20", 700: "#b42318", 800: "#912018", 900: "#7a271a", 950: "#55160c",
};

export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: v("ink"),
        paper: v("paper"),
        surface: v("surface"),
        mist: v("mist"),
        line: v("line"),
        graphite: v("graphite"),
        signal: v("signal"),
        accent: v("accent"),
        "on-accent": v("on-accent"),
        brand: neutral,
        slate: neutral,
        gray: neutral,
        amber: neutral,
        emerald: neutral,
        teal: neutral,
        sky: neutral,
        violet: neutral,
        rose: signal,
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      // Три размера текста: подпись 13, текст 15, крупное число 28. Ранг несут жирность и инверсия.
      // Заголовки страниц и время занятий — отдельные «дисплейные» размеры в компонентах.
      fontSize: {
        xs: ["0.8125rem", { lineHeight: "1.125rem" }],
        sm: ["0.9375rem", { lineHeight: "1.375rem" }],
        base: ["0.9375rem", { lineHeight: "1.375rem" }],
        lg: ["0.9375rem", { lineHeight: "1.375rem" }],
        xl: ["0.9375rem", { lineHeight: "1.375rem" }],
        "2xl": ["1.75rem", { lineHeight: "2rem" }],
        "3xl": ["1.75rem", { lineHeight: "2rem" }],
      },
      borderRadius: { xl: "1rem", "2xl": "1.25rem", "3xl": "1.75rem" },
      letterSpacing: { tightest: "-0.04em" },
    },
  },
  plugins: [],
} satisfies Config;
