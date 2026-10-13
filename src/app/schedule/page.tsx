"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Lesson } from "@/lib/types";
import { lessonsInRange } from "@/lib/logic";
import {
  MONTHS, MONTHS_GEN, WEEKDAYS_SHORT, addDays, addMonths, cls, fmtTime, plural, rub, startOfDay, startOfMonth, startOfWeek, ymd,
} from "@/lib/utils";
import { Button, Empty, IconButton, PageHeader, Segmented } from "@/components/ui";
import { LessonItem, chipClass } from "@/components/LessonItem";
import { LessonModal, StudentSelect } from "@/components/forms";

type View = "day" | "week" | "month";
const H0 = 8, H1 = 22, ROW = 48; // часы сетки и высота часа, px

export default function SchedulePage() {
  const { db } = useStore();
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(startOfDay(new Date()));
  const [studentId, setStudentId] = useState("");
  const [modal, setModal] = useState<{ lesson?: Lesson; report?: boolean; date?: string; time?: string } | null>(null);
  const now = new Date();

  const range = view === "day" ? [cursor, addDays(cursor, 1)] : view === "week" ? [startOfWeek(cursor), addDays(startOfWeek(cursor), 7)] : [startOfWeek(startOfMonth(cursor)), addDays(startOfWeek(addMonths(cursor, 1)), 7)];
  const lessons = lessonsInRange(db, range[0], range[1]).filter((l) => !studentId || l.student_id === studentId);
  const shift = (n: number) => setCursor(view === "day" ? addDays(cursor, n) : view === "week" ? addDays(cursor, 7 * n) : addMonths(cursor, n));
  const title = view === "day"
    ? cursor.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : view === "week"
      ? (() => { const a = startOfWeek(cursor), b = addDays(a, 6); return `${a.getDate()} ${MONTHS_GEN[a.getMonth()]} – ${b.getDate()} ${MONTHS_GEN[b.getMonth()]} ${b.getFullYear()}`; })()
      : `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const open = (l: Lesson) => setModal({ lesson: l });
  const report = (l: Lesson) => setModal({ lesson: l, report: true });
  const active = lessons.filter((l) => !l.status.startsWith("cancelled"));

  const days = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i));

  return (
    <>
      <PageHeader title="Расписание" actions={<Button icon="plus" onClick={() => setModal({ date: ymd(cursor) })}>Занятие</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented<View> value={view} onChange={setView} options={[{ id: "day", label: "День" }, { id: "week", label: "Неделя" }, { id: "month", label: "Месяц" }]} />
        <div className="flex items-center">
          <IconButton icon="left" label="Назад" onClick={() => shift(-1)} />
          <Button variant="ghost" size="sm" onClick={() => setCursor(startOfDay(new Date()))}>Сегодня</Button>
          <IconButton icon="right" label="Вперёд" onClick={() => shift(1)} />
        </div>
        <div className="w-full sm:ml-auto sm:w-56"><StudentSelect value={studentId} onChange={setStudentId} allowEmpty="Все ученики" includeInactive /></div>
      </div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold first-letter:uppercase">{title}</h2>
        <span className="text-sm text-graphite">{active.length} {plural(active.length, "занятие", "занятия", "занятий")} · {rub(active.reduce((s, l) => s + l.price, 0))}</span>
      </div>

      {view === "day" && (
        lessons.length ? <div>{lessons.map((l) => <LessonItem key={l.id} lesson={l} onOpen={open} onReport={report} />)}</div>
          : <Empty icon="calendar" title="Занятий нет" action={<Button icon="plus" onClick={() => setModal({ date: ymd(cursor) })}>Добавить</Button>} />
      )}

      {view === "week" && (
        <>
          {/* телефон: список по дням */}
          <div className="space-y-4 md:hidden">
            {days.map((d) => {
              const ls = lessons.filter((l) => ymd(new Date(l.starts_at)) === ymd(d));
              return (
                <div key={ymd(d)}>
                  <div className={cls("mb-1.5 flex items-center justify-between text-sm font-semibold", ymd(d) === ymd(now) && "text-ink")}>
                    <span>{d.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}</span>
                    <button type="button" className="text-xs font-normal text-graphite" onClick={() => setModal({ date: ymd(d) })}>+ добавить</button>
                  </div>
                  {ls.length ? <div>{ls.map((l) => <LessonItem key={l.id} lesson={l} onOpen={open} onReport={report} />)}</div>
                    : <div className="rounded-lg border border-dashed border-line py-2 text-center text-xs text-graphite">Свободно</div>}
                </div>
              );
            })}
          </div>
          {/* компьютер: сетка */}
          <div className="hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
            <div className="grid grid-cols-[52px_repeat(7,1fr)] border-b border-line">
              <div />
              {days.map((d, i) => (
                <button key={i} type="button" onClick={() => { setCursor(d); setView("day"); }}
                  className={cls("py-2 text-center text-sm", ymd(d) === ymd(now) ? "font-semibold text-ink" : "text-graphite dark:text-graphite")}>
                  {WEEKDAYS_SHORT[i]} <span className={cls("ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full", ymd(d) === ymd(now) && "bg-ink text-paper")}>{d.getDate()}</span>
                </button>
              ))}
            </div>
            <div className="relative grid grid-cols-[52px_repeat(7,1fr)] overflow-y-auto" style={{ maxHeight: "70vh" }}>
              <div>
                {Array.from({ length: H1 - H0 }, (_, i) => (
                  <div key={i} className="pr-2 text-right text-[11px] text-graphite" style={{ height: ROW }}>{H0 + i}:00</div>
                ))}
              </div>
              {days.map((d, di) => {
                const ls = lessons.filter((l) => ymd(new Date(l.starts_at)) === ymd(d));
                return (
                  <div key={di} className="relative border-l border-line">
                    {Array.from({ length: H1 - H0 }, (_, i) => (
                      <button key={i} type="button" aria-label="Добавить занятие" onClick={() => setModal({ date: ymd(d), time: `${String(H0 + i).padStart(2, "0")}:00` })}
                        className="block w-full border-b border-line hover:bg-mist" style={{ height: ROW }} />
                    ))}
                    {ymd(d) === ymd(now) && now.getHours() >= H0 && now.getHours() < H1 && (
                      <div className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-ink" style={{ top: (now.getHours() - H0 + now.getMinutes() / 60) * ROW }} />
                    )}
                    {ls.map((l) => {
                      const t = new Date(l.starts_at);
                      const top = (t.getHours() - H0 + t.getMinutes() / 60) * ROW;
                      const s = db.students.find((x) => x.id === l.student_id);
                      return (
                        <button key={l.id} type="button" onClick={() => open(l)}
                          className={cls("absolute inset-x-1 overflow-hidden rounded-lg px-2 py-1 text-left text-xs leading-tight", chipClass(l))}
                          style={{ top: Math.max(0, top), height: Math.max(22, (l.duration / 60) * ROW - 2) }}
                          title={`${s?.full_name} ${fmtTime(t)}`}>
                          <div className="num font-medium">{fmtTime(t)}</div>
                          <div className="truncate">{s?.full_name.split(" ").slice(0, 2).reverse().join(" ")}</div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {view === "month" && (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="grid grid-cols-7 border-b border-line text-center text-xs font-medium text-graphite">
            {WEEKDAYS_SHORT.map((w) => <div key={w} className="py-2">{w}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: Math.round((range[1].getTime() - range[0].getTime()) / 86400000 / 7) * 7 }, (_, i) => {
              const d = addDays(range[0], i);
              const ls = lessons.filter((l) => ymd(new Date(l.starts_at)) === ymd(d));
              const inMonth = d.getMonth() === cursor.getMonth();
              return (
                <button key={i} type="button" onClick={() => { setCursor(d); setView("day"); }}
                  className={cls("min-h-[64px] border-b border-r border-line p-1.5 text-left align-top hover:bg-mist sm:min-h-[104px]", !inMonth && "text-graphite/60")}>
                  <span className={cls("num inline-flex h-7 w-7 items-center justify-center rounded-full text-xs", ymd(d) === ymd(now) && "bg-ink font-semibold text-paper")}>{d.getDate()}</span>
                  <div className="mt-0.5 hidden space-y-0.5 sm:block">
                    {ls.slice(0, 4).map((l) => {
                      const s = db.students.find((x) => x.id === l.student_id);
                      return <div key={l.id} className={cls("truncate rounded-md px-1.5 py-px text-[11px]", chipClass(l))}><span className="num">{fmtTime(l.starts_at)}</span> {s?.full_name.split(" ")[1]}</div>;
                    })}
                    {ls.length > 4 && <div className="text-[10px] text-graphite">ещё {ls.length - 4}</div>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                    {ls.map((l) => <span key={l.id} className={cls("h-1.5 w-1.5 rounded-full", l.status === "done" ? "bg-ink" : l.status.startsWith("cancelled") ? "bg-line" : "ring-1 ring-ink")} />)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {modal && <LessonModal open lesson={modal.lesson} report={modal.report} preset={{ date: modal.date, time: modal.time, student_id: studentId || undefined }} onClose={() => setModal(null)} />}
    </>
  );
}
