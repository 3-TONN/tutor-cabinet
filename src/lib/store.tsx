"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Backend, INSERT_ORDER, LocalBackend, Role, SupabaseBackend, supabase, supabaseEnabled } from "./backend";
import { DB, Row, SettingsData, TableName, emptyDB } from "./types";
import { DEFAULT_SETTINGS, settingsOf } from "./logic";
import { EGE_INF_SCALE_KEY, buildDemoData } from "./demo";
import { uid } from "./utils";

type Status = "loading" | "signed_out" | "ready" | "error";

interface Store {
  status: Status;
  error: string;
  db: DB;
  settings: SettingsData;
  backend: Backend | null;
  role: Role;
  session: Session | null;
  /** Демо-режим: просмотр кабинета глазами ученика */
  portalStudentId: string | null;
  setPortalStudentId(id: string | null): void;
  insert<T extends TableName>(table: T, rows: Row<T> | Row<T>[]): Promise<void>;
  update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<void>;
  remove(table: TableName, ids: string | string[]): Promise<void>;
  removeStudent(id: string): Promise<void>;
  saveSettings(patch: Partial<SettingsData>): Promise<void>;
  replaceAll(data: DB): Promise<void>;
  loadDemo(): Promise<void>;
  reload(): Promise<void>;
  signOut(): Promise<void>;
  toast(msg: string, kind?: "ok" | "error"): void;
  toasts: { id: string; msg: string; kind: "ok" | "error" }[];
}

const Ctx = createContext<Store | null>(null);

/** Повтор запроса при сбое сети (до 3 попыток с паузой) */
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 400 * i));
    }
  }
}

export const useStore = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore outside provider");
  return c;
};

const STUDENT_TABLES: TableName[] = [
  "lessons", "lesson_series", "payments", "subscriptions", "homework", "assessments", "notes", "student_topics", "student_courses",
];

/** Убрать служебные поля перед вставкой в Supabase (tutor_id подставляется автоматически) */
const clean = (r: object) => {
  const { tutor_id: _t, ...rest } = r as Record<string, unknown>;
  return rest;
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [db, setDb] = useState<DB>(emptyDB());
  const [backend, setBackend] = useState<Backend | null>(null);
  const [role, setRole] = useState<Role>("tutor");
  const [session, setSession] = useState<Session | null>(null);
  const [portalStudentId, setPortalStudentIdState] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Store["toasts"]>([]);
  const dbRef = useRef(db);
  dbRef.current = db;

  const toast = useCallback((msg: string, kind: "ok" | "error" = "ok") => {
    const id = uid();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3000);
  }, []);

  /** alive() === false — пока шла загрузка, начался более новый вход: результат устарел и отбрасывается */
  const init = useCallback(async (b: Backend, r: Role = "tutor", alive: () => boolean = () => true) => {
    try {
      setStatus("loading");
      let data = await b.loadAll();
      if (r === "tutor" && !data.settings.length) {
        // Первый вход: создаём настройки; в демо-режиме — сразу заполняем демо-данными
        const settingsRow = { id: b instanceof SupabaseBackend ? b.user.id : uid(), data: DEFAULT_SETTINGS };
        if (b.mode === "local") {
          const demo = buildDemoData();
          demo.settings = [settingsRow];
          for (const t of INSERT_ORDER) if (demo[t].length) await b.insert(t, demo[t]);
        } else {
          await b.insert("settings", [settingsRow]);
        }
        data = await b.loadAll();
      }
      if (!alive()) return;
      setDb(data);
      setBackend(b);
      setRole(r);
      setStatus("ready");
    } catch (e) {
      if (!alive()) return;
      setError((e as Error).message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    try {
      setPortalStudentIdState(sessionStorage.getItem("portal-student"));
    } catch {}
    if (!supabaseEnabled) {
      init(new LocalBackend());
      return;
    }
    const sb = supabase();
    let generation = 0; // номер последнего запуска входа
    let loadedUser: string | null = null; // чей кабинет уже загружен (или загружается)
    let disposed = false;

    const start = async (s: Session | null) => {
      if (disposed) return;
      setSession(s);
      if (!s) {
        generation++;
        loadedUser = null;
        setBackend(null);
        setDb(emptyDB());
        setStatus("signed_out");
        return;
      }
      // Supabase повторно сообщает о входе при загрузке страницы и при возврате на вкладку.
      // Если кабинет этого пользователя уже открыт или открывается — ничего не перезагружаем.
      if (s.user.id === loadedUser) return;
      loadedUser = s.user.id;
      const my = ++generation;
      const alive = () => !disposed && my === generation;
      const b = new SupabaseBackend(s.user);
      try {
        const r = await withRetry(() => b.role());
        if (!alive()) return;
        await init(b, r, alive);
      } catch (e) {
        if (!alive()) return;
        loadedUser = null; // чтобы кнопка «Повторить» и следующий вход могли попробовать снова
        setError((e as Error).message);
        setStatus("error");
      }
    };

    sb.auth.getSession().then(({ data }) => start(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((event, s) => {
      // Методы Supabase нельзя вызывать прямо в этом обработчике (возможна взаимоблокировка) — откладываем.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "INITIAL_SESSION") setTimeout(() => start(s), 0);
      else if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") setSession(s);
    });
    return () => {
      disposed = true;
      sub.subscription.unsubscribe();
    };
  }, [init]);

  const reload = useCallback(async () => {
    if (!backend) return;
    setDb(await backend.loadAll());
  }, [backend]);

  const fail = useCallback(
    async (e: unknown) => {
      toast(`Ошибка сохранения: ${(e as Error).message}`, "error");
      await reload();
    },
    [toast, reload],
  );

  const insert = useCallback<Store["insert"]>(
    async (table, rows) => {
      const arr = (Array.isArray(rows) ? rows : [rows]) as object[];
      if (!arr.length) return;
      setDb((d) => ({ ...d, [table]: [...d[table], ...arr] }));
      try {
        await backend!.insert(table, arr.map(clean));
      } catch (e) {
        await fail(e);
      }
    },
    [backend, fail],
  );

  const update = useCallback<Store["update"]>(
    async (table, id, patch) => {
      setDb((d) => ({ ...d, [table]: (d[table] as { id: string }[]).map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
      try {
        await backend!.update(table, id, clean(patch));
      } catch (e) {
        await fail(e);
      }
    },
    [backend, fail],
  );

  const remove = useCallback<Store["remove"]>(
    async (table, ids) => {
      const arr = Array.isArray(ids) ? ids : [ids];
      if (!arr.length) return;
      const set = new Set(arr);
      setDb((d) => ({ ...d, [table]: (d[table] as { id: string }[]).filter((r) => !set.has(r.id)) }));
      try {
        await backend!.remove(table, arr);
      } catch (e) {
        await fail(e);
      }
    },
    [backend, fail],
  );

  const removeStudent = useCallback(
    async (id: string) => {
      const d = dbRef.current;
      for (const t of STUDENT_TABLES) {
        const ids = (d[t] as { id: string; student_id: string }[]).filter((r) => r.student_id === id).map((r) => r.id);
        await remove(t, ids);
      }
      await remove("students", [id]);
    },
    [remove],
  );

  const saveSettings = useCallback(
    async (patch: Partial<SettingsData>) => {
      const row = dbRef.current.settings[0];
      const data = { ...settingsOf(dbRef.current), ...patch };
      if (row) await update("settings", row.id, { data });
      else await insert("settings", { id: uid(), data });
    },
    [insert, update],
  );

  const replaceAll = useCallback(
    async (data: DB) => {
      if (!backend) return;
      setStatus("loading");
      try {
        await backend.clearAll();
        for (const t of INSERT_ORDER) {
          if (t === "settings") continue;
          const rows = ((data[t] ?? []) as object[]).map(clean);
          if (rows.length) await backend.insert(t, rows);
        }
        if (data.settings?.[0]?.data) {
          const row = (await backend.loadAll()).settings[0];
          if (row) await backend.update("settings", row.id, { data: { ...DEFAULT_SETTINGS, ...data.settings[0].data } });
        }
        setDb(await backend.loadAll());
        setStatus("ready");
        toast("Данные загружены");
      } catch (e) {
        setStatus("ready");
        toast(`Ошибка импорта: ${(e as Error).message}`, "error");
        await reload();
      }
    },
    [backend, reload, toast],
  );

  const loadDemo = useCallback(async () => {
    const demo = buildDemoData();
    // шкала ЕГЭ по информатике нужна для пробников из демо-данных
    const st = settingsOf(dbRef.current);
    const scale = DEFAULT_SETTINGS.exam_scales.find((x) => x.key === EGE_INF_SCALE_KEY)!;
    const exam_scales = st.exam_scales.some((x) => x.key === EGE_INF_SCALE_KEY) ? st.exam_scales : [scale, ...st.exam_scales];
    demo.settings = [{ id: dbRef.current.settings[0]?.id ?? uid(), data: { ...st, exam_scales } }];
    await replaceAll(demo);
  }, [replaceAll]);

  const signOut = useCallback(async () => {
    if (supabaseEnabled) await supabase().auth.signOut();
  }, []);

  const setPortalStudentId = useCallback((id: string | null) => {
    setPortalStudentIdState(id);
    try {
      if (id) sessionStorage.setItem("portal-student", id);
      else sessionStorage.removeItem("portal-student");
    } catch {}
  }, []);

  const value = useMemo<Store>(
    () => ({
      status, error, db, settings: settingsOf(db), backend, role, session, portalStudentId, setPortalStudentId,
      insert, update, remove, removeStudent, saveSettings, replaceAll, loadDemo, reload, signOut, toast, toasts,
    }),
    [status, error, db, backend, role, session, portalStudentId, setPortalStudentId, insert, update, remove, removeStudent,
      saveSettings, replaceAll, loadDemo, reload, signOut, toast, toasts],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
