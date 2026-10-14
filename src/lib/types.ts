// Модель данных. Имена полей совпадают с колонками в Supabase (snake_case).

export type ID = string;

export interface Attachment {
  name: string;
  url?: string; // внешняя ссылка или data: URL (демо-режим)
  path?: string; // путь в хранилище Supabase Storage
}

export type StudentStatus = "active" | "paused" | "finished";
export type LessonFormat = "online" | "offline";

export interface Student {
  id: ID;
  full_name: string;
  grade: string; // класс / уровень: "9", "11", "студент"
  goal: string;
  phone: string;
  telegram: string;
  whatsapp: string;
  parent_name: string;
  parent_phone: string;
  parent_telegram: string;
  parent_whatsapp: string;
  price: number | null; // индивидуальная стоимость, null — по умолчанию
  duration: number | null; // минут
  format: LessonFormat;
  start_date: string; // YYYY-MM-DD
  status: StudentStatus;
  notes: string;
  portal_emails: string[]; // e-mail ученика/родителя для личного кабинета
  color: string;
  created_at?: string;
}

export interface Subject { id: ID; name: string; }

export interface Course {
  id: ID;
  subject_id: ID | null;
  name: string; // шаблон программы: «ЕГЭ информатика»
  description: string;
}

export interface Topic {
  id: ID;
  course_id: ID;
  section: string; // раздел: «Блок 1 → Обязательная симуляция 1»
  name: string;
  position: number;
}

export interface StudentCourse { id: ID; student_id: ID; course_id: ID; }

export type TopicStatus = "not_started" | "in_progress" | "passed" | "review" | "mastered";

export interface StudentTopic {
  id: ID;
  student_id: ID;
  topic_id: ID;
  status: TopicStatus;
  updated_at: string;
}

export type LessonStatus = "planned" | "done" | "cancelled_student" | "cancelled_tutor" | "no_show";

export interface LessonSeries {
  id: ID;
  student_id: ID;
  weekday: number; // 0 — понедельник
  time: string; // HH:MM
  duration: number;
  start_date: string;
  end_date: string;
}

export interface Lesson {
  id: ID;
  student_id: ID;
  series_id: ID | null;
  starts_at: string; // ISO
  duration: number;
  status: LessonStatus;
  price: number; // стоимость на момент планирования
  late_cancel: boolean; // отмена учеником позже срока — оплачивается
  topic_ids: ID[];
  report_covered: string;
  report_homework: string;
  comment: string;
  grade: number | null; // оценка работы на занятии 1–5
  attachments?: Attachment[]; // материалы для повторения: код, PDF, презентации, ссылки
}

export type PaymentMethod = "cash" | "transfer" | "card";
export type PaymentKind = "single" | "subscription" | "other";

export interface Payment {
  id: ID;
  student_id: ID;
  date: string; // YYYY-MM-DD
  amount: number;
  method: PaymentMethod;
  kind: PaymentKind;
  subscription_id: ID | null;
  comment: string;
}

export interface Subscription {
  id: ID;
  student_id: ID;
  lessons_total: number;
  price_total: number;
  start_date: string;
  expires_at: string;
}

export type AssessmentKind = "test" | "control" | "exam" | "quiz";

export interface Assessment {
  id: ID;
  student_id: ID;
  date: string;
  title: string;
  kind: AssessmentKind;
  topic_ids: ID[];
  max_score: number;
  score: number;
  comment: string;
  exam_scale: string | null; // ключ шкалы перевода баллов
  quiz_id: ID | null;
  answers: Record<string, string | string[]> | null;
  question_points: Record<string, number> | null;
  topic_results: Record<ID, number> | null; // процент по темам
}

export type QuestionType = "single" | "multi" | "open";

export interface Question {
  id: ID;
  type: QuestionType;
  text: string;
  options: string[];
  correct: number[]; // индексы правильных вариантов
  answer: string; // ответ для открытого вопроса (можно несколько через ;)
  points: number;
  topic_id: ID | null;
}

export interface Quiz {
  id: ID;
  title: string;
  description: string;
  topic_ids: ID[];
  questions: Question[];
}

export type HomeworkStatus = "assigned" | "submitted" | "checked" | "missed";

export interface Homework {
  id: ID;
  student_id: ID;
  lesson_id: ID | null;
  title: string;
  description: string;
  topic_ids: ID[];
  assigned_at: string;
  due_date: string;
  attachments: Attachment[];
  status: HomeworkStatus;
  grade: number | null;
  comment: string;
}

export interface Material {
  id: ID;
  title: string;
  description: string;
  topic_ids: ID[];
  attachments: Attachment[];
}

export interface Note {
  id: ID;
  student_id: ID;
  text: string;
  created_at: string;
}

export interface ExamScale {
  key: string;
  name: string;
  max: number;
  map: string; // «первичный:вторичный» через запятую, например "1:6,2:11"
}

export interface SettingsData {
  tutor_name: string;
  default_price: number;
  default_duration: number;
  cancel_hours: number; // отмена позже — оплачивается
  charge_no_show: boolean;
  stale_check_days: number;
  weak_threshold: number; // %
  exam_scales: ExamScale[];
}

export interface SettingsRow { id: ID; data: SettingsData; }

export interface DB {
  settings: SettingsRow[];
  subjects: Subject[];
  courses: Course[];
  topics: Topic[];
  students: Student[];
  student_courses: StudentCourse[];
  student_topics: StudentTopic[];
  lesson_series: LessonSeries[];
  lessons: Lesson[];
  payments: Payment[];
  subscriptions: Subscription[];
  assessments: Assessment[];
  quizzes: Quiz[];
  homework: Homework[];
  materials: Material[];
  notes: Note[];
}

export type TableName = keyof DB;
export type Row<T extends TableName> = DB[T][number];

export const TABLES: TableName[] = [
  "settings", "subjects", "courses", "topics", "students", "student_courses", "student_topics",
  "lesson_series", "lessons", "payments", "subscriptions", "assessments", "quizzes", "homework",
  "materials", "notes",
];

export const emptyDB = (): DB => ({
  settings: [], subjects: [], courses: [], topics: [], students: [], student_courses: [],
  student_topics: [], lesson_series: [], lessons: [], payments: [], subscriptions: [],
  assessments: [], quizzes: [], homework: [], materials: [], notes: [],
});
