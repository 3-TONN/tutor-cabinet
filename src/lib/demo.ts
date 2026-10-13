// Генератор демо-данных для подготовки к ЕГЭ по информатике:
// 5 учеников, ~2 месяца прошедших занятий + 3 недели вперёд, оплаты, абонементы,
// контрольные точки курса (симуляции, проверочные, контрольные), ДЗ, темы.
// Даты считаются от сегодняшнего дня.

import {
  Assessment, Course, DB, Homework, Lesson, LessonSeries, Material, Note, Payment, Question, Quiz, Student,
  StudentCourse, StudentTopic, Subject, Subscription, Topic, TopicStatus, emptyDB,
} from "./types";
import { generateSeriesLessons } from "./logic";
import { EGE_INF_COURSE, planBlocks, type EventKind } from "./ege-informatics";
import { addDays, parseYmd, startOfDay, todayYmd, uid, ymd } from "./utils";

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COMMENTS = [
  "Работал внимательно, хорошо разобрались.", "Пишет код уверенно, но путается в индексах и границах range.",
  "Отлично! Почти все задачи решены самостоятельно.", "Тема даётся тяжело, повторим на следующем занятии.",
  "Хорошая динамика, меньше невнимательных ошибок.", "Решали руками и на Python — второй способ получается лучше.",
];
const HW_TEXTS = [
  "10 заданий по теме из открытого банка ФИПИ",
  "Вариант КЕГЭ: задания по пройденной теме",
  "Написать на Python решения 3 разобранных задач + 2 новые",
  "Задачи из сборника К. Ю. Полякова по теме",
];

/** Таблица перевода ЕГЭ по информатике (первичный → тестовый балл), см. Настройки */
export const EGE_INF_SCALE_KEY = "ege_inf";

export function buildDemoData(): DB {
  const r = rng(20261013);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const db = emptyDB();
  const today = startOfDay(new Date());
  const todayStr = todayYmd();
  const now = new Date();
  const begin = addDays(today, -63);
  const horizon = ymd(addDays(today, 21));

  // --- предмет и программа
  const inf: Subject = { id: uid(), name: "Информатика" };
  db.subjects.push(inf);
  const course: Course = { id: uid(), subject_id: inf.id, ...EGE_INF_COURSE };
  db.courses.push(course);
  const blocks = planBlocks();
  const topics: Topic[] = [];
  /** индекс последней темы блока → контрольные точки после него */
  const eventsAfter = new Map<number, { title: string; kind: EventKind; blockTopics: Topic[] }[]>();
  for (const b of blocks) {
    const blockTopics: Topic[] = b.topics.map((name) => ({ id: uid(), course_id: course.id, section: b.section, name, position: topics.length + b.topics.indexOf(name) }));
    topics.push(...blockTopics);
    if (b.events.length) eventsAfter.set(topics.length - 1, b.events.map((e) => ({ ...e, blockTopics })));
  }
  db.topics.push(...topics);
  const T = (name: string) => topics.find((t) => t.name === name)!;

  // --- ученики
  const base = { telegram: "", whatsapp: "", parent_telegram: "", parent_whatsapp: "", duration: null, notes: "", portal_emails: [] as string[] };
  const st = (p: Partial<Student> & Pick<Student, "full_name" | "grade" | "goal">): Student => ({
    id: uid(), phone: "", parent_name: "", parent_phone: "", price: null, format: "online", status: "active",
    start_date: ymd(begin), color: "#357e81", ...base, ...p,
  });
  const ivan = st({ full_name: "Петров Иван Сергеевич", grade: "11", goal: "ЕГЭ по информатике на 85+", phone: "+7 900 111-22-33", telegram: "@ivan_petrov", parent_name: "Петрова Елена Викторовна", parent_phone: "+7 900 111-22-34", parent_whatsapp: "+79001112234", price: 1800, color: "#357e81", portal_emails: ["ivan@example.com", "petrova@example.com"], notes: "Сильный в программировании, теряет баллы на задачах с электронными таблицами. Хочет поступать на ИТ-направление." });
  const anna = st({ full_name: "Смирнова Анна Дмитриевна", grade: "11", goal: "ЕГЭ по информатике на 70+", phone: "+7 900 222-33-44", parent_name: "Смирнов Дмитрий Олегович", parent_phone: "+7 900 222-33-45", parent_telegram: "@d_smirnov", price: 1500, format: "offline", color: "#b45309", notes: "Начала с нуля в сентябре. Занимаемся у неё дома, свой ноутбук с Python и Excel. Волнуется на симуляциях." });
  const max = st({ full_name: "Козлов Максим Андреевич", grade: "11", goal: "ЕГЭ по информатике на 60+", phone: "+7 900 333-44-55", telegram: "@max_kozlov", parent_name: "Козлова Ирина Петровна", parent_phone: "+7 900 333-44-56", price: 1800, color: "#6d28d9", start_date: ymd(addDays(begin, 2)), notes: "Пропускает ДЗ, нужен контроль. Логику решает быстро устно, код пишет неаккуратно." });
  const maria = st({ full_name: "Волкова Мария Игоревна", grade: "10", goal: "Подготовка к ЕГЭ по информатике заранее (10 класс)", phone: "+7 900 444-55-66", whatsapp: "+79004445566", parent_name: "Волков Игорь Николаевич", parent_phone: "+7 900 444-55-67", color: "#be123c", start_date: ymd(addDays(begin, 5)) });
  const artem = st({ full_name: "Николаев Артём Павлович", grade: "10", goal: "Освоить Python и базу ЕГЭ по информатике", parent_name: "Николаева Ольга Сергеевна", parent_phone: "+7 900 555-66-77", price: 1300, format: "offline", status: "paused", color: "#0369a1", start_date: ymd(addDays(begin, 1)), notes: "Пауза на время соревнований (спорт), вернётся в ноябре." });
  db.students.push(ivan, anna, max, maria, artem);

  // p0 — с какой темы курса ученик начинает в демо-периоде (предыдущие пройдены раньше)
  const plan: { s: Student; slots: [number, string][]; skill: number; hwDiscipline: number; endDate: string; p0: number }[] = [
    { s: ivan, slots: [[1, "17:00"], [4, "17:00"]], skill: 80, hwDiscipline: 0.95, endDate: horizon, p0: 21 },
    { s: anna, slots: [[0, "16:00"], [3, "16:00"]], skill: 74, hwDiscipline: 0.9, endDate: horizon, p0: 0 },
    { s: max, slots: [[2, "18:30"]], skill: 62, hwDiscipline: 0.55, endDate: horizon, p0: 12 },
    { s: maria, slots: [[5, "11:00"]], skill: 70, hwDiscipline: 0.8, endDate: horizon, p0: 2 },
    { s: artem, slots: [[1, "15:00"], [3, "15:00"]], skill: 66, hwDiscipline: 0.75, endDate: ymd(addDays(today, -22)), p0: 0 },
  ];

  for (const p of plan) {
    const { s } = p;
    db.student_courses.push({ id: uid(), student_id: s.id, course_id: course.id } as StudentCourse);
    const price = s.price ?? 1500;
    const statuses = new Map<string, TopicStatus>();

    const addAssessment = (a: Omit<Assessment, "id" | "student_id" | "exam_scale" | "quiz_id" | "answers" | "question_points" | "topic_results"> & Partial<Assessment>) =>
      db.assessments.push({ id: uid(), student_id: s.id, exam_scale: null, quiz_id: null, answers: null, question_points: null, topic_results: null, ...a });

    /** Контрольная точка курса: симуляция ЕГЭ или проверочная/контрольная по блоку */
    const writeEvent = (ev: { title: string; kind: EventKind; blockTopics: Topic[] }, date: string, pointer: number) => {
      if (ev.kind === "exam") {
        const share = clamp((p.skill - 30 + (pointer / topics.length) * 30 + (r() - 0.5) * 12) / 100, 0.1, 0.97);
        addAssessment({ date, title: ev.title, kind: "exam", topic_ids: [], max_score: 29, score: Math.round(29 * share), exam_scale: EGE_INF_SCALE_KEY,
          comment: share < 0.45 ? "Много ошибок во второй части, разберём на занятии" : "Хороший результат, разбор ошибок — на следующем занятии" });
      } else {
        const max_score = ev.title.startsWith("Контрольная") ? 30 : 20;
        const percent = clamp(p.skill + (r() - 0.4) * 30, 25, 100);
        const topic_results: Record<string, number> = {};
        ev.blockTopics.forEach((t) => (topic_results[t.id] = Math.round(clamp(percent + (r() - 0.5) * 35, 15, 100))));
        addAssessment({ date, title: ev.title, kind: "control", topic_ids: ev.blockTopics.map((t) => t.id), max_score, score: Math.round((percent / 100) * max_score),
          comment: percent < 60 ? "Нужно повторить темы блока" : "Блок усвоен", topic_results });
        ev.blockTopics.forEach((t) => {
          if (topic_results[t.id] >= 85 && statuses.get(t.id) === "passed") statuses.set(t.id, "mastered");
          if (topic_results[t.id] < 60) statuses.set(t.id, "review");
        });
      }
    };

    // --- темы, пройденные до демо-периода, и их контрольные точки
    const prior: { ev: { title: string; kind: EventKind; blockTopics: Topic[] }; idx: number }[] = [];
    for (let i = 0; i < p.p0; i++) {
      statuses.set(topics[i].id, r() < 0.3 ? "mastered" : "passed");
      eventsAfter.get(i)?.forEach((ev) => prior.push({ ev, idx: i }));
    }
    prior.forEach(({ ev, idx }, j) => writeEvent(ev, ymd(addDays(begin, -7 * (prior.length - j))), idx + 1));

    // --- регулярные занятия
    const lessons: Lesson[] = [];
    for (const [weekday, time] of p.slots) {
      const series: LessonSeries = { id: uid(), student_id: s.id, weekday, time, duration: 60, start_date: s.start_date, end_date: p.endDate };
      db.lesson_series.push(series);
      lessons.push(...generateSeriesLessons(series, price, lessons));
    }
    lessons.sort((a, b) => a.starts_at.localeCompare(b.starts_at));

    // --- статусы и отчёты по прошедшим
    let pointer = p.p0;
    const covered: string[] = [];
    let doneCount = 0;
    let reviewNext: string | null = null;
    let onTopic = 0;
    for (const l of lessons) {
      if (new Date(l.starts_at) > now) continue;
      const x = r();
      if (x < 0.05) { l.status = "cancelled_student"; l.late_cancel = r() < 0.5; l.comment = l.late_cancel ? "Отмена за 3 часа до занятия" : "Предупредил заранее (болеет)"; continue; }
      if (x < 0.08) { l.status = "cancelled_tutor"; l.comment = "Перенос по моей инициативе"; continue; }
      if (x < 0.1 && s.id !== ivan.id) { l.status = "no_show"; l.comment = "Не пришёл, не предупредил"; continue; }
      if (ymd(new Date(l.starts_at)) === todayStr) continue; // сегодняшнее прошедшее — ждёт отчёта
      if (pointer >= topics.length) break;
      l.status = "done";
      doneCount++;
      const t = topics[pointer];
      l.topic_ids = [t.id];
      if (!covered.includes(t.id)) covered.push(t.id);
      statuses.set(t.id, "in_progress");
      const intro = doneCount === 1 && p.p0 === 0 ? "Вводная беседа: цели, план курса, формат КЕГЭ. " : "";
      const review = reviewNext ? `Разбор: ${reviewNext}. ` : "";
      reviewNext = null;
      l.report_covered = `${intro}${review}${t.name}: теория и разбор типовых заданий`;
      l.report_homework = pick(HW_TEXTS);
      l.comment = pick(COMMENTS);
      l.grade = clamp(Math.round(3 + (p.skill - 55) / 15 + (r() - 0.5)), 3, 5);

      // ДЗ к занятию
      const next = lessons.find((n) => n.starts_at > l.starts_at && n.status !== "cancelled_tutor");
      const due = next ? ymd(new Date(next.starts_at)) : ymd(addDays(new Date(l.starts_at), 7));
      let hstatus: Homework["status"] = "assigned";
      let grade: number | null = null;
      let comment = "";
      if (due < todayStr) {
        if (r() < p.hwDiscipline) { hstatus = "checked"; grade = clamp(Math.round(3 + (p.skill - 55) / 14 + (r() - 0.4)), 2, 5); comment = grade >= 4 ? "Хорошо, код рабочий" : "Есть ошибки, разобрали на занятии"; }
        else hstatus = "missed";
      } else if (r() < 0.4) hstatus = "submitted";
      db.homework.push({
        id: uid(), student_id: s.id, lesson_id: l.id, title: `ДЗ: ${t.name}`, description: l.report_homework, topic_ids: [t.id],
        assigned_at: ymd(new Date(l.starts_at)), due_date: due, attachments: r() < 0.3 ? [{ name: "Открытый банк заданий ФИПИ", url: "https://fipi.ru/ege/otkrytyy-bank-zadaniy-ege" }] : [],
        status: hstatus, grade, comment,
      });

      const date = ymd(new Date(l.starts_at));
      const quiet = s.id === maria.id && date > ymd(addDays(today, -20)); // у Марии давно не было проверки

      // короткий тест каждые 4 проведённых занятия
      if (doneCount % 4 === 0 && !quiet) {
        const tIds = covered.slice(-3);
        const percent = clamp(p.skill + doneCount / 2 + (r() - 0.5) * 40, 25, 100);
        const topic_results: Record<string, number> = {};
        tIds.forEach((id) => (topic_results[id] = Math.round(clamp(percent + (r() - 0.5) * 30, 20, 100))));
        addAssessment({ date, title: "Тест по темам", kind: "test", topic_ids: tIds, max_score: 10, score: Math.round(percent / 10),
          comment: percent < 60 ? "Нужно повторить" : "Хороший результат", topic_results });
        tIds.forEach((id) => topic_results[id] < 60 && statuses.set(id, "review"));
      }

      // тема пройдена (иногда тема занимает два занятия)
      if (++onTopic >= 2 || r() < 0.8) {
        onTopic = 0;
        if (statuses.get(t.id) === "in_progress") statuses.set(t.id, "passed");
        const evs = eventsAfter.get(pointer);
        pointer++;
        if (evs) {
          const evDate = ymd(addDays(new Date(l.starts_at), 1));
          if (evDate < todayStr && !quiet) {
            evs.forEach((ev) => writeEvent(ev, evDate, pointer));
            const exam = evs.find((e) => e.kind === "exam");
            if (exam) reviewNext = exam.title;
          }
        }
      }
    }
    statuses.forEach((status, topic_id) =>
      db.student_topics.push({ id: uid(), student_id: s.id, topic_id, status, updated_at: todayStr } as StudentTopic));
    db.lessons.push(...lessons);

    // --- оплаты
    const chargeable = lessons.filter((l) => l.status === "done" || l.status === "no_show" || (l.status === "cancelled_student" && l.late_cancel));
    const pay = (date: string, amount: number, kind: Payment["kind"], subscription_id: string | null = null, comment = "") =>
      db.payments.push({ id: uid(), student_id: s.id, date, amount, method: pick(["transfer", "transfer", "card", "cash"] as const), kind, subscription_id, comment });
    const sub = (start: Date, n: number, perLesson: number) => {
      const x: Subscription = { id: uid(), student_id: s.id, lessons_total: n, price_total: n * perLesson, start_date: ymd(start), expires_at: ymd(addDays(start, 45)) };
      db.subscriptions.push(x);
      pay(x.start_date, x.price_total, "subscription", x.id, `Абонемент на ${n} занятий`);
    };
    if (s.id === ivan.id) {
      // абонементы по 8 занятий (скидка 150 ₽ за занятие)
      for (let i = 0; i < chargeable.length; i += 8) sub(new Date(chargeable[i].starts_at), 8, price - 150);
    } else if (s.id === max.id) {
      // в последнем абонементе на 4 занятия осталось 1
      const n = chargeable.length;
      const singles = (n - 3 + 400) % 4;
      chargeable.slice(0, singles).forEach((l) => pay(ymd(new Date(l.starts_at)), price, "single", null, "Разовое занятие"));
      for (let i = singles; i < n; i += 4) sub(new Date(chargeable[i].starts_at), 4, price - 100);
    } else if (s.id === anna.id) {
      // платит после занятия, последние два не оплачены — долг
      chargeable.slice(0, Math.max(0, chargeable.length - 2)).forEach((l) => pay(ymd(new Date(l.starts_at)), price, "single", null, "Разовое занятие"));
    } else if (s.id === maria.id) {
      // предоплата раз в месяц
      for (let m = parseYmd(s.start_date); m <= today; m = addDays(m, 28)) pay(ymd(m), price * 5, "other", null, "Предоплата за месяц");
    } else {
      chargeable.forEach((l) => pay(ymd(new Date(l.starts_at)), price, "single", null, "Разовое занятие"));
    }
  }

  // --- тесты в приложении
  const q = (p: Partial<Question> & Pick<Question, "type" | "text">): Question => ({ id: uid(), options: [], correct: [], answer: "", points: 1, topic_id: null, ...p });
  const tBase = T("Python. Основы"), tWhile = T("Python. Цикл while"), tFor = T("Python. Цикл for");
  const quiz1: Quiz = {
    id: uid(), title: "Python. Основы и циклы", description: "Экспресс-тест, 10 минут", topic_ids: [tBase.id, tWhile.id, tFor.id],
    questions: [
      q({ type: "open", text: "Что выведет программа?\nprint(17 % 5)", answer: "2", topic_id: tBase.id }),
      q({ type: "open", text: "Что выведет программа?\nprint(2 ** 10)", answer: "1024", topic_id: tBase.id }),
      q({ type: "single", text: "Сколько раз выполнится тело цикла?\nfor i in range(3, 15, 4):", options: ["3", "4", "12", "15"], correct: [0], topic_id: tFor.id }),
      q({ type: "single", text: "Что выведет программа?\ns = 0\ni = 1\nwhile i < 10:\n    s += i\n    i *= 2\nprint(s)", options: ["15", "31", "10", "7"], correct: [0], topic_id: tWhile.id }),
      q({ type: "multi", text: "Какие выражения дают список [0, 1, 2]?", options: ["list(range(3))", "[0, 1, 2]", "range(0, 2)", "[i for i in range(3)]"], correct: [0, 1, 3], points: 2, topic_id: tBase.id }),
    ],
  };
  const tSys = T("Системы счисления");
  const quiz2: Quiz = {
    id: uid(), title: "Системы счисления — экспресс-тест", description: "Перевод чисел, задания 14 ЕГЭ", topic_ids: [tSys.id],
    questions: [
      q({ type: "open", text: "Переведите 1011₂ в десятичную систему", answer: "11", topic_id: tSys.id }),
      q({ type: "open", text: "Переведите FF₁₆ в десятичную систему", answer: "255", topic_id: tSys.id }),
      q({ type: "open", text: "Сколько единиц в двоичной записи числа 37?", answer: "3", topic_id: tSys.id }),
      q({ type: "multi", text: "Какие записи равны десятичному числу 10?", options: ["1010₂", "12₈", "1100₂", "B₁₆"], correct: [0, 1], points: 2, topic_id: tSys.id }),
    ],
  };
  const tLog = T("Основы логики 1"), tCode = T("Кодирование информации"), tMem = T("Объём памяти");
  const quiz3: Quiz = {
    id: uid(), title: "Логика и кодирование", description: "Задания 2, 4, 7 ЕГЭ — база", topic_ids: [tLog.id, tCode.id, tMem.id],
    questions: [
      q({ type: "single", text: "Какое выражение равносильно A → B?", options: ["¬A ∨ B", "A ∨ ¬B", "¬A ∧ B", "A ∧ ¬B"], correct: [0], topic_id: tLog.id }),
      q({ type: "single", text: "Чему равно ¬A ∨ B при A = 1, B = 0?", options: ["0", "1"], correct: [0], topic_id: tLog.id }),
      q({ type: "open", text: "Сколько бит нужно, чтобы закодировать один из 64 цветов?", answer: "6", topic_id: tCode.id }),
      q({ type: "open", text: "Изображение 1024×768 пикселей, палитра из 256 цветов, без сжатия. Сколько Кбайт оно занимает?", answer: "768", topic_id: tMem.id }),
    ],
  };
  db.quizzes.push(quiz1, quiz2, quiz3);
  const qa = quiz1.questions;
  db.assessments.push({
    id: uid(), student_id: anna.id, date: ymd(addDays(today, -3)), title: quiz1.title, kind: "quiz", topic_ids: quiz1.topic_ids,
    max_score: 6, score: 3, comment: "Ошибки в range с шагом и в списках", exam_scale: null, quiz_id: quiz1.id,
    answers: { [qa[0].id]: "2", [qa[1].id]: "1024", [qa[2].id]: "1", [qa[3].id]: "0", [qa[4].id]: ["0", "1"] },
    question_points: { [qa[0].id]: 1, [qa[1].id]: 1, [qa[2].id]: 0, [qa[3].id]: 1, [qa[4].id]: 0 },
    topic_results: { [tBase.id]: 50, [tFor.id]: 0, [tWhile.id]: 100 },
  });

  // --- материалы
  const games = [T("Теория игр. Основы"), T("Теория игр. Одна куча камней"), T("Python. Теория игр. Одна куча камней"), T("Теория игр. Две кучи камней"), T("Python. Теория игр. Две кучи камней")];
  const mats: Material[] = [
    { id: uid(), title: "Открытый банк заданий ЕГЭ (ФИПИ)", description: "Официальные задания по всем номерам", topic_ids: [], attachments: [{ name: "fipi.ru", url: "https://fipi.ru/ege/otkrytyy-bank-zadaniy-ege" }] },
    { id: uid(), title: "Демоверсия ЕГЭ по информатике", description: "Демоверсия, спецификация и кодификатор текущего года", topic_ids: [], attachments: [{ name: "fipi.ru", url: "https://fipi.ru/ege/demoversii-specifikacii-kodifikatory" }] },
    { id: uid(), title: "Материалы К. Ю. Полякова для подготовки к ЕГЭ", description: "Задачи по всем номерам с ответами", topic_ids: [], attachments: [{ name: "kpolyakov.spb.ru", url: "https://kpolyakov.spb.ru/school/ege.htm" }] },
    { id: uid(), title: "Шпаргалка: системы счисления в Python", description: "int(s, base), bin, oct, hex, перевод в произвольную систему", topic_ids: [tSys.id], attachments: [] },
    { id: uid(), title: "Таблицы истинности на Python", description: "Шаблон перебора через itertools.product", topic_ids: [T("Логические функции").id, tLog.id], attachments: [] },
    { id: uid(), title: "Теория игр: шаблон решения", description: "Ручной разбор выигрышных позиций и рекурсивное решение на Python", topic_ids: games.map((t) => t.id), attachments: [] },
  ];
  db.materials.push(...mats);

  // --- заметки
  const note = (s: Student, text: string, days: number): Note => ({ id: uid(), student_id: s.id, text, created_at: addDays(today, -days).toISOString() });
  db.notes.push(
    note(ivan, "Задания 3, 9, 18 (электронные таблицы) — делать больше практики в Excel, не только Python.", 20),
    note(ivan, "Мама просила присылать отчёт раз в месяц.", 5),
    note(anna, "Перед симуляцией — разминка на 5 минут, иначе зажимается.", 30),
    note(max, "Договорились: ДЗ присылает код в Telegram до 20:00 накануне.", 10),
    note(maria, "Хорошо работает с визуальными схемами (графы, деревья игр).", 15),
  );

  return db;
}
