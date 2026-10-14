"use client";

// Карта курса как кодовая таблица: каждая тема — клетка с шестнадцатеричным адресом
// (адрес = порядковый номер темы в программе). Статус читается заливкой, фокус на клетке
// поднимает её, остальное приглушается, а внизу стеклянная строка-отсчёт печатает адрес,
// тему, блок и результат.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useStore } from "@/lib/store";
import { TOPIC_STATUS, TOPIC_STATUS_ORDER, progress, studentTopicList, topicScores, topicStatus } from "@/lib/logic";
import { cls, fmtDate } from "@/lib/utils";

const hex = (n: number, width = 2) => n.toString(16).toUpperCase().padStart(width, "0");

export function CourseChart({ studentId }: { studentId: string }) {
  const { db } = useStore();
  const wrap = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [cols, setCols] = useState(16);
  const [active, setActive] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);

  // 16 колонок на широком экране, 8 — на телефоне (адреса строк меняют шаг вместе с сеткой)
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setCols(e.contentRect.width >= 760 ? 16 : 8));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const topics = useMemo(() => studentTopicList(db, studentId), [db, studentId]);
  const scores = useMemo(() => topicScores(db, studentId), [db, studentId]);
  const pr = progress(db, studentId);
  const statuses = topics.map((t) => topicStatus(db, studentId, t.id));
  const blockEnd = topics.map((t, i) => i === topics.length - 1 || topics[i + 1].section !== t.section);
  const lastSeen = useMemo(() => {
    const m = new Map<string, string>();
    db.lessons
      .filter((l) => l.student_id === studentId && l.status === "done")
      .forEach((l) => l.topic_ids.forEach((id) => (!m.has(id) || m.get(id)! < l.starts_at) && m.set(id, l.starts_at)));
    return m;
  }, [db, studentId]);

  if (!topics.length) return null;

  const rows = Math.ceil(topics.length / cols);
  const focus = active ?? pinned;
  const next = statuses.findIndex((s) => s === "in_progress" || s === "not_started");

  const move = (e: KeyboardEvent, i: number) => {
    const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    if (d == null) return;
    e.preventDefault();
    const j = Math.max(0, Math.min(topics.length - 1, i + d));
    cellRefs.current[j]?.focus();
  };

  const readout = (i: number) => {
    const t = topics[i];
    const sc = scores.get(t.id);
    const seen = lastSeen.get(t.id);
    return (
      <>
        <b className="num text-accent">0x{hex(i)}</b>
        <span className="font-semibold">{t.name}</span>
        <span className="text-graphite">{t.section}</span>
        <span>{TOPIC_STATUS[statuses[i]].label}{sc ? ` · ${Math.round(sc.avg)}% по проверкам` : ""}</span>
        {seen && <span className="num text-graphite">занятие {fmtDate(seen)}</span>}
      </>
    );
  };

  return (
    <div ref={wrap} className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-ink bg-paper">
        <div role="grid" aria-label={`Карта курса: ${pr.covered} из ${pr.total} тем пройдено`}
          className="grid" style={{ gridTemplateColumns: `2.75rem repeat(${cols}, minmax(0, 1fr))` }}
          onMouseLeave={() => setActive(null)}>
          {/* шапка: адреса столбцов */}
          <div className="bg-ink" aria-hidden />
          {Array.from({ length: cols }, (_, c) => (
            <div key={c} aria-hidden className="num flex h-7 items-center justify-center bg-ink text-xs font-medium text-paper">{hex(c, 1)}</div>
          ))}
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} role="row" className="contents">
              <div aria-hidden className="num flex items-center justify-center bg-ink text-xs font-medium text-paper">{hex(r * cols)}</div>
              {Array.from({ length: cols }, (_, c) => {
                const i = r * cols + c;
                if (i >= topics.length) return <div key={c} aria-hidden className="border-l border-t border-line bg-mist/50" />;
                const t = topics[i];
                const st = statuses[i];
                const sc = scores.get(t.id);
                const dim = focus != null && focus !== i;
                return (
                  <button key={c} ref={(el) => { cellRefs.current[i] = el; }} type="button" role="gridcell"
                    aria-label={`0x${hex(i)} ${t.name}: ${TOPIC_STATUS[st].label}${sc ? `, ${Math.round(sc.avg)}%` : ""}`}
                    aria-pressed={pinned === i}
                    onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
                    onClick={() => setPinned(pinned === i ? null : i)} onKeyDown={(e) => move(e, i)}
                    style={{ animationDelay: `${Math.min(i, 96) * 6}ms` }}
                    title={t.name}
                    className={cls("cell-in relative flex min-w-0 flex-col items-start overflow-hidden border-l border-t border-line p-1.5 text-left outline-none transition-opacity duration-200",
                      cols === 16 ? "h-14" : "h-12",
                      TOPIC_STATUS[st].cell, dim && "opacity-35",
                      focus === i && "z-10 ring-[3px] ring-inset ring-accent",
                      i === next && focus == null && "ring-2 ring-inset ring-accent/70")}>
                    <span className="num text-xs font-medium opacity-70">{hex(i)}</span>
                    {/* как в кодовой таблице: в клетке адрес, имя — в строке-отсчёте и подсказке */}
                    {sc && <span className="num mt-auto self-end text-xs opacity-80">{Math.round(sc.avg)}</span>}
                    {/* конец блока — дальше контрольная точка курса */}
                    {blockEnd[i] && <span aria-hidden className="absolute inset-y-1 right-0 w-[3px] rounded-full bg-ink" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* живой отсчёт: адрес и состояние клетки под фокусом */}
      <div className="glass sticky bottom-24 z-20 flex min-h-[3rem] flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl px-4 py-2.5 text-sm lg:bottom-4" aria-live="polite">
        {focus != null ? readout(focus) : (
          <>
            <b className="num">{pr.covered}/{pr.total}</b>
            <span>тем пройдено · {Math.round(pr.percent)}% программы</span>
            {next >= 0 && <span className="text-graphite">следующая: <b className="num text-accent">0x{hex(next)}</b> {topics[next].name}</span>}
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-graphite">
        {TOPIC_STATUS_ORDER.map((s) => (
          <span key={s} className="flex items-center gap-1.5"><span className={cls("h-3.5 w-3.5 rounded-sm", TOPIC_STATUS[s].cell)} />{TOPIC_STATUS[s].label}</span>
        ))}
        <span className="flex items-center gap-1.5"><span className="h-3.5 w-[3px] rounded-full bg-ink" />конец блока, дальше контрольная точка</span>
      </div>
    </div>
  );
}
