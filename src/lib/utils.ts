// Даты, форматирование, мелкие помощники. Неделя начинается с понедельника.

export const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD по местному времени */
export const ymd = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayYmd = () => ymd(new Date());
export const parseYmd = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
/** ДД.ММ.ГГГГ */
export const fmtDate = (s: string | Date | null | undefined): string => {
  if (!s) return "—";
  const d = typeof s === "string" ? (s.length === 10 ? parseYmd(s) : new Date(s)) : s;
  if (isNaN(d.getTime())) return "—";
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};
export const fmtTime = (s: string | Date): string => {
  const d = typeof s === "string" ? new Date(s) : s;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fmtDateTime = (s: string) => `${fmtDate(s)} ${fmtTime(s)}`;

export const WEEKDAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
export const WEEKDAYS = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];
export const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
export const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

/** 0 — понедельник … 6 — воскресенье */
export const weekdayMon = (d: Date) => (d.getDay() + 6) % 7;
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
export const startOfWeek = (d: Date) => addDays(startOfDay(d), -weekdayMon(d));
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
export const sameDay = (a: Date, b: Date) => ymd(a) === ymd(b);
export const monthKey = (s: string) => s.slice(0, 7); // YYYY-MM
export const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
export const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
/** Дата + время в ISO */
export const combine = (date: string, time: string) => {
  const d = parseYmd(date);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
};

export const rub = (n: number) =>
  // неразрывные пробелы: сумма никогда не переносится посередине («43 950 ₽»)
  `${Math.round(n).toLocaleString("ru-RU").replace(/[\s\u00a0\u202f]/g, "\u00a0")}\u00a0₽`;
export const pct = (n: number) => `${Math.round(n)}%`;

export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export const cls = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

export const shortName = (full: string) => {
  const p = full.trim().split(/\s+/);
  if (p.length < 2) return full;
  return `${p[1]} ${p[0][0]}.`; // «Иван П.» из «Петров Иван Сергеевич»
};

export function downloadFile(name: string, content: string | Blob, type = "text/plain;charset=utf-8") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** CSV для Excel (русская локаль): BOM + разделитель «;» */
export function toCsv(rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n");
}

export const normalizeAnswer = (s: string) =>
  s.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, "").replace(/,/g, ".");

export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const avg = (a: number[]) => (a.length ? sum(a) / a.length : 0);
