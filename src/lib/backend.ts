// Слой хранения. Два варианта с одинаковым интерфейсом:
//  • SupabaseBackend — база в облаке, вход по e-mail, RLS разграничивает доступ;
//  • LocalBackend   — демо-режим без сервера: всё хранится в localStorage браузера.

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { Attachment, DB, TABLES, TableName, emptyDB } from "./types";
import { uid } from "./utils";

/** none — аккаунт ни к чему не привязан (например, ученика удалили): доступа нет */
export type Role = "tutor" | "student" | "none";

export interface Backend {
  mode: "local" | "supabase";
  loadAll(): Promise<DB>;
  insert(table: TableName, rows: object[]): Promise<void>;
  update(table: TableName, id: string, patch: object): Promise<void>;
  remove(table: TableName, ids: string[]): Promise<void>;
  clearAll(): Promise<void>;
  upload(file: File): Promise<Attachment>;
  fileUrl(a: Attachment): Promise<string>;
}

// ---------------------------------------------------------------- Supabase

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const supabaseEnabled = Boolean(URL_ && KEY);

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!client) client = createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

const PAGE = 1000;
// Порядок удаления/вставки с учётом внешних ключей
const INSERT_ORDER: TableName[] = [
  "settings", "subjects", "courses", "topics", "students", "student_courses", "student_topics",
  "lesson_series", "subscriptions", "lessons", "payments", "quizzes", "assessments", "homework",
  "materials", "notes",
];

export class SupabaseBackend implements Backend {
  mode = "supabase" as const;
  private currentRole: Role = "tutor";
  constructor(public user: User) {}

  async loadAll(): Promise<DB> {
    const db = emptyDB();
    await Promise.all(
      TABLES.map(async (t) => {
        const rows: object[] = [];
        if (t === "students" && this.currentRole === "student") {
          // ученику — карточки без личных заметок репетитора
          const { data, error } = await supabase().rpc("portal_students");
          if (error) throw new Error(`${t}: ${error.message}`);
          (db[t] as object[]) = data ?? [];
          return;
        }
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase().from(t).select("*").range(from, from + PAGE - 1);
          if (error) throw new Error(`${t}: ${error.message}`);
          rows.push(...(data ?? []));
          if (!data || data.length < PAGE) break;
        }
        (db[t] as object[]) = rows;
      }),
    );
    // Единый формат времени (ISO с «Z»), чтобы строки корректно сравнивались
    const iso = (v: string) => (v ? new Date(v).toISOString() : v);
    db.lessons.forEach((l) => (l.starts_at = iso(l.starts_at)));
    db.notes.forEach((n) => (n.created_at = iso(n.created_at)));
    db.lessons.forEach((l) => {
      l.price = Number(l.price);
    });
    db.payments.forEach((p) => (p.amount = Number(p.amount)));
    db.subscriptions.forEach((x) => (x.price_total = Number(x.price_total)));
    db.assessments.forEach((a) => {
      a.score = Number(a.score);
      a.max_score = Number(a.max_score);
    });
    db.students.forEach((s) => {
      if (s.price != null) s.price = Number(s.price);
    });
    return db;
  }

  async insert(table: TableName, rows: object[]) {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase().from(table).insert(rows.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }
  }

  async update(table: TableName, id: string, patch: object) {
    const { error } = await supabase().from(table).update(patch).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async remove(table: TableName, ids: string[]) {
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await supabase().from(table).delete().in("id", ids.slice(i, i + 200));
      if (error) throw new Error(error.message);
    }
  }

  async clearAll() {
    for (const t of [...INSERT_ORDER].reverse()) {
      if (t === "settings") continue;
      const { error } = await supabase().from(t).delete().eq("tutor_id", this.user.id);
      if (error) throw new Error(error.message);
    }
  }

  async upload(file: File): Promise<Attachment> {
    const safe = file.name.replace(/[^\wа-яА-ЯёЁ.\-]+/g, "_");
    const path = `${this.user.id}/${uid()}-${safe}`;
    const { error } = await supabase().storage.from("files").upload(path, file);
    if (error) throw new Error(error.message);
    return { name: file.name, path };
  }

  async fileUrl(a: Attachment) {
    if (a.url) return a.url;
    const { data, error } = await supabase().storage.from("files").createSignedUrl(a.path!, 3600);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  }

  async role(): Promise<Role> {
    const { data, error } = await supabase().rpc("my_role");
    if (error) throw new Error(error.message);
    // неизвестный ответ трактуется как «нет доступа», а не как репетитор
    this.currentRole = data === "tutor" ? "tutor" : data === "student" ? "student" : "none";
    return this.currentRole;
  }
}

// ---------------------------------------------------------------- Local (демо)

// v2 — демо-данные под ЕГЭ по информатике (старые данные v1 остаются в браузере нетронутыми)
const LS_KEY = "tutor-cabinet-db-v2";

export class LocalBackend implements Backend {
  mode = "local" as const;
  private db: DB = emptyDB();

  private persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.db));
    } catch {
      throw new Error("Не удалось сохранить данные в браузере (закончилось место?)");
    }
  }

  async loadAll(): Promise<DB> {
    try {
      const raw = localStorage.getItem(LS_KEY);
      this.db = raw ? { ...emptyDB(), ...JSON.parse(raw) } : emptyDB();
    } catch {
      this.db = emptyDB();
    }
    return structuredClone(this.db);
  }

  async insert(table: TableName, rows: object[]) {
    (this.db[table] as object[]).push(...structuredClone(rows));
    this.persist();
  }

  async update(table: TableName, id: string, patch: object) {
    const arr = this.db[table] as { id: string }[];
    const i = arr.findIndex((r) => r.id === id);
    if (i >= 0) arr[i] = { ...arr[i], ...structuredClone(patch) };
    this.persist();
  }

  async remove(table: TableName, ids: string[]) {
    const set = new Set(ids);
    (this.db[table] as { id: string }[]) = (this.db[table] as { id: string }[]).filter((r) => !set.has(r.id));
    this.persist();
  }

  async clearAll() {
    const settings = this.db.settings;
    this.db = { ...emptyDB(), settings };
    this.persist();
  }

  async upload(file: File): Promise<Attachment> {
    if (file.size > 700 * 1024)
      throw new Error("В демо-режиме можно прикреплять файлы до 700 КБ. Подключите Supabase или добавьте ссылку.");
    const url = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(new Error("Не удалось прочитать файл"));
      r.readAsDataURL(file);
    });
    return { name: file.name, url };
  }

  async fileUrl(a: Attachment) {
    return a.url || "";
  }
}

export { INSERT_ORDER };
