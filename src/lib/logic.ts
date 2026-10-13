// Бизнес-логика: баланс, абонементы, прогресс, слабые темы, статистика.
// Всё считается «на лету» из исходных данных, поэтому правка задним числом
// (например, изменение статуса старого занятия) сразу корректно пересчитывает баланс.

import {
  Assessment, DB, ExamScale, Homework, HomeworkStatus, Lesson, LessonStatus, SettingsData, Student,
  Subscription, Topic, TopicStatus,
} from "./types";
import { addDays, avg, combine, daysBetween, monthKey, parseYmd, sum, todayYmd, uid, ymd } from "./utils";

export const DEFAULT_SETTINGS: SettingsData = {
  tutor_name: "",
  default_price: 1500,
  default_duration: 60,
  cancel_hours: 24,
  charge_no_show: true,
  stale_check_days: 14,
  weak_threshold: 70,
  exam_scales: [
    {
      key: "ege_inf",
      name: "ЕГЭ информатика (тестовый балл)",
      max: 29,
      map: "1:7,2:14,3:20,4:27,5:34,6:40,7:43,8:46,9:48,10:51,11:54,12:56,13:59,14:62,15:64,16:67,17:70,18:72,19:75,20:78,21:80,22:83,23:85,24:88,25:90,26:93,27:95,28:98,29:100",
    },
  ],
};

export const settingsOf = (db: DB): SettingsData => ({ ...DEFAULT_SETTINGS, ...(db.settings[0]?.data ?? {}) });

// ---------------------------------------------------------------- подписи

export const LESSON_STATUS: Record<LessonStatus, { label: string; color: string }> = {
  planned: { label: "Запланировано", color: "blue" },
  done: { label: "Проведено", color: "green" },
  cancelled_student: { label: "Отменено учеником", color: "amber" },
  cancelled_tutor: { label: "Отменено мной", color: "gray" },
  no_show: { label: "Пропуск без предупреждения", color: "red" },
};

// Карта тем в монохроме: пусто → штриховка → полутон → заливка; красный — только «требует повторения».
export const TOPIC_STATUS: Record<TopicStatus, { label: string; color: string; cell: string; weight: number }> = {
  not_started: { label: "Не начата", color: "gray", cell: "ring-1 ring-inset ring-line text-graphite", weight: 0 },
  in_progress: { label: "В процессе", color: "amber", cell: "hatch ring-1 ring-inset ring-ink/50 text-ink", weight: 0.5 },
  review: { label: "Требует повторения", color: "red", cell: "bg-signal/15 ring-1 ring-inset ring-signal text-signal", weight: 0.5 },
  passed: { label: "Пройдена", color: "teal", cell: "bg-ink/25 text-ink", weight: 1 },
  mastered: { label: "Освоена", color: "green", cell: "bg-ink text-paper", weight: 1 },
};
export const TOPIC_STATUS_ORDER: TopicStatus[] = ["not_started", "in_progress", "passed", "review", "mastered"];

export const HW_STATUS: Record<HomeworkStatus | "overdue", { label: string; color: string }> = {
  assigned: { label: "Выдано", color: "blue" },
  submitted: { label: "Сдано", color: "amber" },
  checked: { label: "Проверено", color: "green" },
  missed: { label: "Не сдано", color: "red" },
  overdue: { label: "Просрочено", color: "red" },
};

export const STUDENT_STATUS = {
  active: { label: "Активный", color: "green" },
  paused: { label: "На паузе", color: "amber" },
  finished: { label: "Завершил", color: "gray" },
} as const;

export const PAYMENT_METHOD = { cash: "Наличные", transfer: "Перевод", card: "Карта" } as const;
export const PAYMENT_KIND = { single: "Разовое занятие", subscription: "Абонемент", other: "Пополнение баланса" } as const;
export const ASSESSMENT_KIND = { test: "Тест", control: "Проверочная / контрольная", exam: "Симуляция ЕГЭ", quiz: "Тест в приложении" } as const;

// ---------------------------------------------------------------- ученики

export const studentPrice = (s: Student | undefined, st: SettingsData) => s?.price ?? st.default_price;
export const studentDuration = (s: Student | undefined, st: SettingsData) => s?.duration ?? st.default_duration;
export const studentById = (db: DB, id: string) => db.students.find((s) => s.id === id);

// ---------------------------------------------------------------- финансы

export function isChargeable(l: Lesson, st: SettingsData) {
  if (l.status === "done") return true;
  if (l.status === "cancelled_student") return l.late_cancel;
  if (l.status === "no_show") return st.charge_no_show;
  return false;
}

/** Отмена учеником позже, чем за cancel_hours часов, — оплачивается */
export const isLateCancel = (startsAt: string, st: SettingsData, now = new Date()) =>
  (new Date(startsAt).getTime() - now.getTime()) / 3600000 < st.cancel_hours;

export interface SubUsage { sub: Subscription; used: number; left: number; expired: boolean; perLesson: number; }
export interface Ledger {
  charges: Map<string, { amount: number; subscription_id: string | null }>;
  charged: number;
  paid: number;
  balance: number;
  subs: SubUsage[];
  activeSub: SubUsage | null;
}

export function ledger(db: DB, studentId: string, st: SettingsData, until?: string): Ledger {
  const lessons = db.lessons
    .filter((l) => l.student_id === studentId && isChargeable(l, st) && (!until || l.starts_at <= until))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const subs: SubUsage[] = db.subscriptions
    .filter((s) => s.student_id === studentId)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .map((sub) => ({ sub, used: 0, left: sub.lessons_total, expired: false, perLesson: sub.price_total / Math.max(1, sub.lessons_total) }));
  const charges = new Map<string, { amount: number; subscription_id: string | null }>();
  for (const l of lessons) {
    const d = ymd(new Date(l.starts_at));
    const u = subs.find((x) => x.sub.start_date <= d && d <= x.sub.expires_at && x.used < x.sub.lessons_total);
    if (u) {
      u.used++;
      charges.set(l.id, { amount: u.perLesson, subscription_id: u.sub.id });
    } else charges.set(l.id, { amount: l.price, subscription_id: null });
  }
  const today = todayYmd();
  subs.forEach((u) => {
    u.left = u.sub.lessons_total - u.used;
    u.expired = u.sub.expires_at < today;
  });
  const charged = sum([...charges.values()].map((c) => c.amount));
  const paid = sum(db.payments.filter((p) => p.student_id === studentId && (!until || p.date <= until.slice(0, 10))).map((p) => p.amount));
  const activeSub = subs.find((u) => !u.expired && u.left > 0) ?? null;
  return { charges, charged, paid, balance: paid - charged, subs, activeSub };
}

export function allLedgers(db: DB, st: SettingsData) {
  const m = new Map<string, Ledger>();
  db.students.forEach((s) => m.set(s.id, ledger(db, s.id, st)));
  return m;
}

export interface PaymentAlert { student: Student; kind: "debt" | "last_lesson"; text: string; balance: number; }
export function paymentAlerts(db: DB, st: SettingsData): PaymentAlert[] {
  const res: PaymentAlert[] = [];
  for (const s of db.students) {
    if (s.status === "finished" && ledger(db, s.id, st).balance >= 0) continue;
    const lg = ledger(db, s.id, st);
    if (lg.balance < 0) res.push({ student: s, kind: "debt", balance: lg.balance, text: "Задолженность" });
    else if (lg.activeSub && lg.activeSub.left === 1)
      res.push({ student: s, kind: "last_lesson", balance: lg.balance, text: "В абонементе осталось 1 занятие" });
  }
  return res.sort((a, b) => a.balance - b.balance);
}

/** Начисления по проведённым (оплачиваемым) занятиям по месяцам */
export function earnedByMonth(db: DB, st: SettingsData) {
  const m = new Map<string, number>();
  db.students.forEach((s) => {
    const lg = ledger(db, s.id, st);
    db.lessons.forEach((l) => {
      const c = lg.charges.get(l.id);
      if (c) m.set(monthKey(ymd(new Date(l.starts_at))), (m.get(monthKey(ymd(new Date(l.starts_at)))) ?? 0) + c.amount);
    });
  });
  return m;
}

export function paidByMonth(db: DB) {
  const m = new Map<string, number>();
  db.payments.forEach((p) => m.set(monthKey(p.date), (m.get(monthKey(p.date)) ?? 0) + p.amount));
  return m;
}

/** Ожидаемый доход по расписанию: запланированные занятия месяца */
export function expectedForMonth(db: DB, key: string) {
  return sum(db.lessons.filter((l) => l.status === "planned" && monthKey(ymd(new Date(l.starts_at))) === key).map((l) => l.price));
}

// ---------------------------------------------------------------- расписание

/** Создать занятия по регулярному правилу (еженедельно) */
export function generateSeriesLessons(
  s: { id: string; student_id: string; weekday: number; time: string; duration: number; start_date: string; end_date: string },
  price: number,
  existing: Lesson[] = [],
): Lesson[] {
  const res: Lesson[] = [];
  let d = parseYmd(s.start_date);
  const end = parseYmd(s.end_date);
  while ((d.getDay() + 6) % 7 !== s.weekday) d = addDays(d, 1);
  const taken = new Set(existing.filter((l) => l.student_id === s.student_id).map((l) => l.starts_at));
  for (; d <= end; d = addDays(d, 7)) {
    const starts_at = combine(ymd(d), s.time);
    if (taken.has(starts_at)) continue;
    res.push(newLesson({ student_id: s.student_id, series_id: s.id, starts_at, duration: s.duration, price }));
  }
  return res;
}

export const newLesson = (p: Partial<Lesson> & { student_id: string; starts_at: string; price: number; duration: number }): Lesson => ({
  id: uid(), series_id: null, status: "planned", late_cancel: false, topic_ids: [], report_covered: "",
  report_homework: "", comment: "", grade: null, ...p,
});

export const lessonEnd = (l: Lesson) => new Date(new Date(l.starts_at).getTime() + l.duration * 60000);

/** Пересечения по времени с другими занятиями */
export function conflicts(db: DB, starts_at: string, duration: number, exceptId?: string) {
  const a = new Date(starts_at).getTime(), b = a + duration * 60000;
  return db.lessons.filter((l) => {
    if (l.id === exceptId || l.status === "cancelled_student" || l.status === "cancelled_tutor") return false;
    const x = new Date(l.starts_at).getTime(), y = x + l.duration * 60000;
    return x < b && a < y;
  });
}

// ---------------------------------------------------------------- темы и прогресс

export function studentTopicList(db: DB, studentId: string): Topic[] {
  const courseIds = new Set(db.student_courses.filter((c) => c.student_id === studentId).map((c) => c.course_id));
  return db.topics
    .filter((t) => courseIds.has(t.course_id))
    .sort((a, b) => a.course_id.localeCompare(b.course_id) || a.position - b.position);
}

export function topicStatus(db: DB, studentId: string, topicId: string): TopicStatus {
  return db.student_topics.find((x) => x.student_id === studentId && x.topic_id === topicId)?.status ?? "not_started";
}

export function progress(db: DB, studentId: string) {
  const topics = studentTopicList(db, studentId);
  if (!topics.length) return { total: 0, covered: 0, percent: 0, weighted: 0 };
  const statuses = topics.map((t) => topicStatus(db, studentId, t.id));
  const covered = statuses.filter((s) => s === "passed" || s === "mastered" || s === "review").length;
  const weighted = sum(statuses.map((s) => TOPIC_STATUS[s].weight)) / topics.length * 100;
  return { total: topics.length, covered, percent: (covered / topics.length) * 100, weighted };
}

/** Процент по теме из одной проверки */
export function assessmentTopicPercent(a: Assessment, topicId: string): number | null {
  if (a.topic_results && a.topic_results[topicId] != null) return a.topic_results[topicId];
  if (a.topic_ids.includes(topicId) && a.max_score > 0) return (a.score / a.max_score) * 100;
  return null;
}

export const assessmentPercent = (a: Assessment) => (a.max_score > 0 ? (a.score / a.max_score) * 100 : 0);

export function topicScores(db: DB, studentId: string) {
  const m = new Map<string, { values: { date: string; percent: number }[]; avg: number; last: number }>();
  db.assessments
    .filter((a) => a.student_id === studentId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((a) => {
      const ids = new Set([...a.topic_ids, ...Object.keys(a.topic_results ?? {})]);
      ids.forEach((tid) => {
        const p = assessmentTopicPercent(a, tid);
        if (p == null) return;
        const e = m.get(tid) ?? { values: [], avg: 0, last: 0 };
        e.values.push({ date: a.date, percent: p });
        m.set(tid, e);
      });
    });
  m.forEach((e) => {
    // Средний по последним трём результатам — отражает текущий уровень
    e.avg = avg(e.values.slice(-3).map((v) => v.percent));
    e.last = e.values[e.values.length - 1].percent;
  });
  return m;
}

export function weakTopics(db: DB, studentId: string, st: SettingsData) {
  const scores = topicScores(db, studentId);
  return [...scores.entries()]
    .filter(([, e]) => e.avg < st.weak_threshold)
    .map(([tid, e]) => ({ topic: db.topics.find((t) => t.id === tid), avg: e.avg, count: e.values.length }))
    .filter((x): x is { topic: Topic; avg: number; count: number } => !!x.topic)
    .sort((a, b) => a.avg - b.avg);
}

export function lastAssessmentDate(db: DB, studentId: string): string | null {
  const d = db.assessments.filter((a) => a.student_id === studentId).map((a) => a.date).sort();
  return d.length ? d[d.length - 1] : null;
}

export function staleStudents(db: DB, st: SettingsData) {
  const today = new Date();
  return db.students
    .filter((s) => s.status === "active")
    .map((s) => {
      const last = lastAssessmentDate(db, s.id);
      return { student: s, last, days: last ? daysBetween(parseYmd(last), today) : null };
    })
    .filter((x) => x.days == null || x.days > st.stale_check_days)
    .sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999));
}

// ---------------------------------------------------------------- ДЗ

export const hwEffective = (h: Homework): HomeworkStatus | "overdue" =>
  h.status === "assigned" && h.due_date < todayYmd() ? "overdue" : h.status;

export function homeworkStats(db: DB, studentId: string, from?: string, to?: string) {
  const list = db.homework.filter((h) => h.student_id === studentId && (!from || h.due_date >= from) && (!to || h.due_date <= to));
  const done = list.filter((h) => h.status === "submitted" || h.status === "checked").length;
  const failed = list.filter((h) => h.status === "missed" || hwEffective(h) === "overdue").length;
  const graded = list.filter((h) => h.grade != null).map((h) => h.grade!);
  const base = done + failed;
  return { total: list.length, done, failed, pending: list.length - base, rate: base ? (done / base) * 100 : null, avgGrade: graded.length ? avg(graded) : null };
}

// ---------------------------------------------------------------- экзамены

export function parseScale(scale: ExamScale): [number, number][] {
  return scale.map
    .split(",")
    .map((p) => p.split(":").map((x) => Number(x.trim())) as [number, number])
    .filter(([a, b]) => !isNaN(a) && !isNaN(b))
    .sort((a, b) => a[0] - b[0]);
}

/** Перевод первичного балла: берётся последнее значение шкалы с порогом ≤ балла */
export function convertScore(scale: ExamScale | undefined, primary: number): number | null {
  if (!scale) return null;
  const pts = parseScale(scale);
  let res: number | null = primary <= 0 ? 0 : null;
  for (const [p, s] of pts) if (primary >= p) res = s;
  return res;
}

// ---------------------------------------------------------------- период

export function attendance(db: DB, studentId: string, from: string, to: string) {
  const lessons = db.lessons.filter((l) => {
    const d = ymd(new Date(l.starts_at));
    return l.student_id === studentId && d >= from && d <= to;
  });
  const by = (s: LessonStatus) => lessons.filter((l) => l.status === s).length;
  return {
    lessons,
    done: by("done"),
    cancelled_student: by("cancelled_student"),
    cancelled_tutor: by("cancelled_tutor"),
    no_show: by("no_show"),
    planned: by("planned"),
  };
}

export const lessonsInRange = (db: DB, from: Date, to: Date) =>
  db.lessons
    .filter((l) => {
      const t = new Date(l.starts_at);
      return t >= from && t < to;
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

export const topicName = (db: DB, id: string) => db.topics.find((t) => t.id === id)?.name ?? "";
export const topicNames = (db: DB, ids: string[]) => ids.map((id) => topicName(db, id)).filter(Boolean);
