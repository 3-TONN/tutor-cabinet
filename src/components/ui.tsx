"use client";

// UI-кит в чёрно-белой системе. Чернила (ink) — главное действие и «сделано»,
// контур — «запланировано», туман (mist) — нейтральные заливки, сигнал — только деньги/просрочка/удаление.

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from "react";
import { cls } from "@/lib/utils";
import { Icon, type IconName } from "./Icon";

// ---------------------------------------------------------------- кнопки

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink/85 active:bg-ink/75",
  secondary: "bg-transparent text-ink ring-1 ring-inset ring-ink/20 hover:ring-ink/60 hover:bg-mist",
  ghost: "text-ink hover:bg-mist",
  danger: "bg-signal text-white hover:bg-signal/90",
};

export function Button({
  variant = "primary", icon, size = "md", className, children, ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: IconName; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      {...p}
      className={cls(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap",
        size === "sm" ? "h-9 px-3.5 text-sm" : "h-11 px-5 text-sm",
        variants[variant], className,
      )}
    >
      {icon && <Icon name={icon} className="w-[18px] h-[18px]" />}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string }) {
  return (
    <button type="button" aria-label={label} title={label} {...p}
      className={cls("inline-flex h-10 w-10 items-center justify-center rounded-full text-graphite transition-colors hover:bg-mist hover:text-ink", className)}>
      <Icon name={icon} className="w-[18px] h-[18px]" />
    </button>
  );
}

// ---------------------------------------------------------------- поля

const fieldCls =
  "w-full rounded-xl border border-transparent bg-mist px-3.5 py-2.5 text-base text-ink placeholder:text-graphite/80 transition-colors hover:border-line focus:border-ink focus:bg-surface focus:outline-none disabled:opacity-60";

export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cls(fieldCls, className)} />;
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={cls(fieldCls, "leading-relaxed", className)} />;
export const Select = ({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={cls(fieldCls, "cursor-pointer pr-9", className)}>{children}</select>
);

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cls("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-graphite">{hint}</span>}
    </label>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2.5 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 rounded accent-ink" />
      {label}
    </label>
  );
}

// ---------------------------------------------------------------- контейнеры

/**
 * Секция. По умолчанию — без рамки: заголовок и тонкая линия сверху.
 * boxed — самостоятельный объект в сетке (материал, тест, вопрос).
 */
export function Card({ title, actions, children, className, padded = true, boxed }: {
  title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean; boxed?: boolean;
}) {
  if (boxed)
    return (
      <section className={cls("rounded-2xl border border-line bg-surface", className)}>
        {(title || actions) && (
          <header className="flex items-center justify-between gap-2 px-5 pt-4">
            <h2 className="font-semibold">{title}</h2>
            <div className="flex items-center gap-1">{actions}</div>
          </header>
        )}
        <div className={padded ? "p-5" : ""}>{children}</div>
      </section>
    );
  return (
    <section className={cls("border-t border-line", className)}>
      {(title || actions) && (
        <header className="flex min-h-[52px] items-center justify-between gap-2 py-3">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <div className="flex items-center gap-1 text-sm">{actions}</div>
        </header>
      )}
      <div className={padded ? (title || actions ? "pb-4" : "py-4") : ""}>{children}</div>
    </section>
  );
}

const badgeColors: Record<string, string> = {
  green: "bg-ink text-paper", // сделано / положительно
  teal: "bg-ink/70 text-paper",
  blue: "ring-1 ring-inset ring-ink/50 text-ink", // запланировано / выдано
  amber: "border border-dashed border-ink/50 text-ink", // требует внимания
  gray: "bg-mist text-graphite",
  violet: "bg-mist text-ink font-mono",
  red: "bg-signal/10 text-signal ring-1 ring-inset ring-signal/30", // деньги / просрочка
};
export const Badge = ({ color = "gray", children, className }: { color?: string; children: ReactNode; className?: string }) => (
  <span className={cls("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", badgeColors[color] ?? badgeColors.gray, className)}>{children}</span>
);

export function Empty({ icon = "folder", title, text, action }: { icon?: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full ring-1 ring-line text-graphite"><Icon name={icon} className="w-5 h-5" /></div>
      <p className="font-medium">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-graphite">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Показатель: подпись + крупное моноширинное число. Ставится в StatRow. */
export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="bg-paper p-4 sm:p-5">
      <div className="text-sm text-graphite">{label}</div>
      <div className={cls("num mt-2 text-2xl font-medium sm:text-[1.75rem] sm:leading-none", tone === "bad" && "text-signal")}>{value}</div>
      {sub && <div className="mt-2 text-xs text-graphite">{sub}</div>}
    </div>
  );
}
export const StatRow = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cls("grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4", className)}>{children}</div>
);

export function Progress({ value, className }: { value: number; className?: string; color?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cls("h-1.5 w-full overflow-hidden rounded-full bg-mist", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-ink transition-[width] duration-300" style={{ width: `${v}%` }} />
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 no-print">
      <div role="tablist" className="inline-flex min-w-full gap-6 border-b border-line">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
            className={cls("-mb-px whitespace-nowrap border-b-2 py-3 text-sm font-medium transition-colors",
              value === t.id ? "border-ink text-ink" : "border-transparent text-graphite hover:text-ink")}>
            {t.label}
            {t.count != null && <span className="num ml-1.5 text-xs text-graphite">{t.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-full bg-mist p-1">
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}
          className={cls("h-9 rounded-full px-4 text-sm font-medium transition-colors",
            value === o.id ? "bg-ink text-paper" : "text-graphite hover:text-ink")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 no-print">
      <div className="min-w-0">
        <h1 className="text-[2rem] font-bold leading-[1.05] tracking-tightest sm:text-[2.75rem]">{title}</h1>
        {subtitle && <p className="mt-2 text-base text-graphite">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- модальное окно

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && onClose();
    document.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal className={cls("flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-surface sm:rounded-3xl sm:border sm:border-line", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}>
        <header className="flex items-center justify-between gap-2 px-6 pb-2 pt-5">
          <h3 className="text-xl font-bold tracking-tight">{title}</h3>
          <IconButton icon="x" label="Закрыть" onClick={onClose} />
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</footer>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- подтверждение

type ConfirmOpts = { title: string; text?: string; ok?: string; danger?: boolean };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null);
  const resolver = useRef<(v: boolean) => void>(() => {});
  const confirm = useCallback((o: ConfirmOpts) => {
    setOpts(o);
    return new Promise<boolean>((res) => (resolver.current = res));
  }, []);
  const close = (v: boolean) => {
    resolver.current(v);
    setOpts(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!opts} onClose={() => close(false)} title={opts?.title ?? ""}
        footer={<>
          <Button variant="secondary" onClick={() => close(false)}>Отмена</Button>
          <Button variant={opts?.danger === false ? "primary" : "danger"} onClick={() => close(true)}>{opts?.ok ?? "Удалить"}</Button>
        </>}>
        <p className="text-base text-graphite">{opts?.text ?? "Это действие нельзя отменить."}</p>
      </Modal>
    </ConfirmCtx.Provider>
  );
}

// ---------------------------------------------------------------- мелочи

/** Инициалы в круге. Цвет ученика не используется — интерфейс монохромный. */
export function Avatar({ name, size = 36 }: { name: string; color?: string; size?: number }) {
  const p = name.trim().split(/\s+/);
  const initials = ((p[1]?.[0] ?? "") + (p[0]?.[0] ?? "")).toUpperCase();
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-ink font-semibold text-paper"
      style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </span>
  );
}

export function SearchInput({ value, onChange, placeholder = "Поиск" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-graphite"><Icon name="search" className="w-4 h-4" /></span>
      <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="pl-10" />
    </div>
  );
}

/** Множественный выбор из списка с группировкой (например, темы по разделам) */
export function MultiPick({ options, value, onChange, placeholder = "Не выбрано" }: {
  options: { id: string; label: string; group?: string }[]; value: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    // Esc закрывает только список, а не всё модальное окно
    const k = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
    };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k, true);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k, true);
    };
  }, [open]);
  const filtered = options.filter((o) => !q || o.label.toLowerCase().includes(q.toLowerCase()));
  const groups = [...new Set(filtered.map((o) => o.group ?? ""))];
  const selected = options.filter((o) => value.includes(o.id));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={cls(fieldCls, "flex min-h-[46px] flex-wrap items-center gap-1.5 text-left")}>
        {selected.length ? selected.map((o) => <Badge key={o.id} color="green">{o.label}</Badge>) : <span className="text-graphite">{placeholder}</span>}
        <Icon name="down" className="ml-auto w-4 h-4 text-graphite" />
      </button>
      {open && (
        <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-line bg-surface p-2">
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти тему" className="mb-2" />
          {!filtered.length && <p className="p-2 text-sm text-graphite">Ничего не найдено. Измените запрос.</p>}
          {groups.map((g) => (
            <div key={g}>
              {g && <div className="px-2 pb-1 pt-3 text-xs font-semibold text-graphite">{g}</div>}
              {filtered.filter((o) => (o.group ?? "") === g).map((o) => (
                <label key={o.id} className="flex min-h-[40px] cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm hover:bg-mist">
                  <input type="checkbox" className="h-4 w-4 accent-ink" checked={value.includes(o.id)} onChange={() => toggle(o.id)} />
                  {o.label}
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Table({ head, children, className }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={cls("overflow-x-auto", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink text-left text-xs text-graphite">
            {head.map((h, i) => <th key={i} scope="col" className="whitespace-nowrap px-3 py-2.5 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}
