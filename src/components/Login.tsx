"use client";

import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/backend";
import { Button, Field, Input, Segmented } from "./ui";
import { Icon } from "./Icon";

type Mode = "signin" | "signup" | "magic";

export function Login() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const sb = supabase().auth;
    const redirect = typeof window !== "undefined" ? window.location.origin : undefined;
    try {
      if (mode === "signin") {
        const { error } = await sb.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await sb.signUp({ email, password, options: { emailRedirectTo: redirect } });
        if (error) throw error;
        if (!data.session) setMsg({ text: "Мы отправили письмо для подтверждения адреса. Перейдите по ссылке из письма." });
      } else {
        const { error } = await sb.signInWithOtp({ email, options: { emailRedirectTo: redirect, shouldCreateUser: true } });
        if (error) throw error;
        setMsg({ text: "Ссылка для входа отправлена на почту." });
      }
    } catch (err) {
      const m = (err as Error).message;
      setMsg({ error: true, text: m === "Invalid login credentials" ? "Неверный e-mail или пароль" : m });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="mb-10 flex items-center gap-3">
          <span className="num flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-sm font-semibold text-paper">{"{}"}</span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Кабинет репетитора</h1>
            <p className="text-xs text-graphite">Для репетитора, учеников и родителей</p>
          </div>
        </div>
        <Segmented<Mode> value={mode} onChange={(m) => { setMode(m); setMsg(null); }}
          options={[{ id: "signin", label: "Вход" }, { id: "signup", label: "Регистрация" }, { id: "magic", label: "По ссылке" }]} />
        <div className="mt-4 space-y-3">
          <Field label="E-mail"><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          {mode !== "magic" && (
            <Field label="Пароль" hint={mode === "signup" ? "Не менее 6 символов" : undefined}>
              <Input type="password" required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          )}
        </div>
        {msg && <p className={`mt-3 text-sm ${msg.error ? "text-signal" : "text-ink"}`}>{msg.text}</p>}
        <Button type="submit" disabled={busy} className="mt-5 w-full">
          {busy ? "Подождите…" : mode === "signin" ? "Войти" : mode === "signup" ? "Зарегистрироваться" : "Получить ссылку"}
        </Button>
        <p className="mt-4 text-xs text-graphite">
          Ученики и родители входят с e-mail, который репетитор указал в карточке ученика, — им откроется личный кабинет только для просмотра.
        </p>
      </form>
    </div>
  );
}
