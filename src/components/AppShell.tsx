"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { supabaseEnabled } from "@/lib/backend";
import { cls } from "@/lib/utils";
import { Icon, type IconName } from "./Icon";
import { Button } from "./ui";
import { useTheme } from "./Providers";
import { Login } from "./Login";
import { PortalView } from "./PortalView";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Главная", icon: "home" },
  { href: "/schedule", label: "Расписание", icon: "calendar" },
  { href: "/students", label: "Ученики", icon: "users" },
  { href: "/topics", label: "Программа", icon: "book" },
  { href: "/tests", label: "Контроль знаний", icon: "target" },
  { href: "/homework", label: "Домашние задания", icon: "clipboard" },
  { href: "/finance", label: "Оплаты и финансы", icon: "wallet" },
  { href: "/reports", label: "Отчёты родителям", icon: "file" },
  { href: "/materials", label: "Материалы", icon: "folder" },
  { href: "/settings", label: "Настройки", icon: "settings" },
];
const MOBILE_MAIN = ["/", "/schedule", "/students", "/finance"];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

function ThemeToggle({ compact }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const label = theme === "light" ? "Светлая тема" : theme === "dark" ? "Тёмная тема" : "Как в системе";
  return (
    <button type="button" onClick={() => setTheme(next)} title={`${label} (нажмите, чтобы сменить)`}
      className="flex h-10 w-full items-center gap-3 rounded-full px-4 text-sm text-ink/75 hover:bg-mist hover:text-ink">
      <Icon name={theme === "dark" ? "moon" : "sun"} className="w-[18px] h-[18px]" />
      {!compact && label}
    </button>
  );
}

function Spinner({ text = "Загрузка…" }: { text?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center gap-3 text-graphite">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink border-t-transparent" />
      {text}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { status, error, role, backend, signOut, session, toasts, portalStudentId, setPortalStudentId, db } = useStore();
  const path = usePathname();
  const [more, setMore] = useState(false);

  if (status === "loading") return <Spinner />;
  if (status === "signed_out") return <Login />;
  if (status === "error")
    return (
      <div className="mx-auto max-w-lg p-6 pt-20 text-center">
        <h1 className="text-lg font-semibold">Не удалось загрузить данные</h1>
        <p className="mt-2 break-words text-sm text-graphite">{error}</p>
        <p className="mt-2 text-sm text-graphite">Проверьте, что SQL-скрипт <code>supabase/schema.sql</code> выполнен в вашем проекте Supabase.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={() => location.reload()}>Повторить</Button>
          {supabaseEnabled && <Button variant="secondary" onClick={signOut}>Выйти</Button>}
        </div>
      </div>
    );

  const toastsEl = (
    <div role="status" aria-live="polite" className="fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-8 no-print">
      {toasts.map((t) => (
        <div key={t.id} className={cls("rounded-full px-5 py-3 text-sm font-medium", t.kind === "error" ? "bg-signal text-white" : "bg-ink text-paper")}>{t.msg}</div>
      ))}
    </div>
  );

  // Личный кабинет ученика / родителя
  if (role === "none")
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="glass glass-strong max-w-md rounded-3xl p-8 text-center">
          <span className="num mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-ink text-sm font-semibold text-paper">{"{}"}</span>
          <h1 className="text-2xl font-bold tracking-tight">Нет доступа к кабинету</h1>
          <p className="mt-3 text-graphite">
            Аккаунт {session?.user.email} не привязан ни к одному ученику. Если вы ученик или родитель, попросите репетитора указать
            этот e-mail в карточке ученика и войдите снова.
          </p>
          <Button className="mt-6" icon="logout" onClick={signOut}>Выйти</Button>
        </div>
      </div>
    );
  if (role === "student")
    return (<><PortalView studentIds={db.students.map((s) => s.id)} onExit={signOut} exitLabel="Выйти" />{toastsEl}</>);
  if (path.startsWith("/portal") && portalStudentId && db.students.some((s) => s.id === portalStudentId))
    return (<><PortalView studentIds={[portalStudentId]} demo onExit={() => { setPortalStudentId(null); history.back(); }} exitLabel="Вернуться в кабинет репетитора" />{toastsEl}</>);

  const navLink = (n: (typeof NAV)[number]) => (
    <Link key={n.href} href={n.href} aria-current={isActive(path, n.href) ? "page" : undefined}
      className={cls("flex h-10 items-center gap-3 rounded-full px-4 text-sm font-medium transition-colors",
        isActive(path, n.href) ? "bg-accent text-on-accent" : "text-ink/80 hover:bg-ink/[0.06] hover:text-ink")}>
      <Icon name={n.icon} className="w-[18px] h-[18px]" />
      {n.label}
    </Link>
  );

  return (
    <div className="min-h-screen lg:pl-[19rem]">
      {/* боковое меню (компьютер) */}
      <aside className="glass fixed inset-y-3 left-3 z-30 hidden w-[17.25rem] flex-col rounded-3xl px-4 py-6 lg:flex no-print">
        <Link href="/" className="mb-8 flex items-center gap-3 px-2">
          <span className="num flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-sm font-semibold text-paper">{"{}"}</span>
          <span className="leading-tight">
            <span className="block font-bold tracking-tight">Кабинет репетитора</span>
            <span className="block text-xs text-graphite">ЕГЭ по информатике</span>
          </span>
        </Link>
        <nav className="flex-1 space-y-1 overflow-y-auto" aria-label="Основное меню">
          {NAV.slice(0, 6).map(navLink)}
          <div className="!my-4 mx-4 border-t border-line" />
          {NAV.slice(6, 9).map(navLink)}
        </nav>
        <div className="space-y-1 border-t border-line pt-4">
          {navLink(NAV[9])}
          <ThemeToggle />
          {backend?.mode === "local" ? (
            <p className="px-4 pt-2 text-xs leading-relaxed text-graphite">Демо-режим: данные хранятся только в этом браузере</p>
          ) : (
            <button type="button" onClick={signOut} className="flex h-10 w-full items-center gap-3 rounded-full px-4 text-sm text-ink/75 hover:bg-mist">
              <Icon name="logout" className="w-[18px] h-[18px]" />
              <span className="truncate">Выйти · {session?.user.email}</span>
            </button>
          )}
        </div>
      </aside>

      <main className="mx-auto max-w-6xl px-4 pb-32 pt-8 sm:px-8 lg:pb-12 lg:pt-12">{children}</main>

      {/* нижняя навигация (телефон) */}
      <nav aria-label="Основное меню" className="glass fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 grid grid-cols-5 rounded-[1.75rem] px-1 lg:hidden no-print">
        {NAV.filter((n) => MOBILE_MAIN.includes(n.href)).map((n) => {
          const on = isActive(path, n.href);
          return (
            <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined} className={cls("flex flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-medium", on ? "text-ink" : "text-graphite")}>
              <span className={cls("flex h-8 w-14 items-center justify-center rounded-full transition-colors", on && "bg-accent text-on-accent")}><Icon name={n.icon} className="w-5 h-5" /></span>
              {n.label === "Оплаты и финансы" ? "Финансы" : n.label}
            </Link>
          );
        })}
        {(() => {
          const on = NAV.some((n) => !MOBILE_MAIN.includes(n.href) && isActive(path, n.href));
          return (
            <button type="button" onClick={() => setMore(true)} aria-haspopup="dialog" className={cls("flex flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-medium", on ? "text-ink" : "text-graphite")}>
              <span className={cls("flex h-8 w-14 items-center justify-center rounded-full", on && "bg-accent text-on-accent")}><Icon name="menu" className="w-5 h-5" /></span>Ещё
            </button>
          );
        })()}
      </nav>

      {more && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/35 lg:hidden" onClick={() => setMore(false)}>
          <div role="dialog" aria-label="Все разделы" className="glass glass-strong w-full rounded-t-3xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
            <div className="grid grid-cols-3 gap-2">
              {NAV.filter((n) => !MOBILE_MAIN.includes(n.href)).map((n) => (
                <Link key={n.href} href={n.href} onClick={() => setMore(false)}
                  className={cls("flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl p-3 text-center text-xs font-medium", isActive(path, n.href) ? "bg-accent text-on-accent" : "bg-paper/70 text-ink ring-1 ring-inset ring-line")}>
                  <Icon name={n.icon} className="w-6 h-6" />
                  {n.label}
                </Link>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <ThemeToggle />
              {backend?.mode === "supabase" && (
                <button type="button" onClick={signOut} className="flex h-10 items-center gap-3 rounded-full px-4 text-sm text-ink/75">
                  <Icon name="logout" className="w-[18px] h-[18px]" />Выйти
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {toastsEl}
    </div>
  );
}
