"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Lesson } from "@/lib/types";
import {
  HW_STATUS, LESSON_STATUS, earnedByMonth, expectedForMonth, hwEffective, lessonsInRange, paidByMonth, paymentAlerts, staleStudents, topicNames,
} from "@/lib/logic";
import { addDays, addMonths, cls, fmtDate, fmtTime, monthKey, plural, rub, startOfDay, startOfWeek, ymd, WEEKDAYS_SHORT, MONTHS_GEN } from "@/lib/utils";
import { Badge, Button, Card, Empty, PageHeader, Stat, StatRow } from "@/components/ui";
import { LessonItem, chipClass } from "@/components/LessonItem";
import { HomeworkModal, LessonModal, PaymentModal } from "@/components/forms";
import { Icon } from "@/components/Icon";

export default function Dashboard() {
  const { db, settings } = useStore();
  const [lessonModal, setLessonModal] = useState<{ lesson?: Lesson; report?: boolean } | null>(null);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [hwId, setHwId] = useState<string | null>(null);

  const now = new Date();
  const today = startOfDay(now);
  const todayLessons = lessonsInRange(db, today, addDays(today, 1));
  const weekStart = startOfWeek(now);
  const weekLessons = lessonsInRange(db, weekStart, addDays(weekStart, 7)).filter((l) => !l.status.startsWith("cancelled"));
  const unmarked = db.lessons.filter((l) => l.status === "planned" && new Date(l.starts_at).getTime() + l.duration * 60000 < now.getTime() && l.starts_at < today.toISOString())
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  const alerts = useMemo(() => paymentAlerts(db, settings), [db, settings]);
  const stale = useMemo(() => staleStudents(db, settings), [db, settings]);
  const hwOpen = db.homework
    .map((h) => ({ h, eff: hwEffective(h) }))
    .filter((x) => x.eff === "overdue" || x.eff === "submitted")
    .sort((a, b) => a.h.due_date.localeCompare(b.h.due_date));

  const thisKey = monthKey(ymd(now));
  const prevKey = monthKey(ymd(addMonths(now, -1)));
  const paid = paidByMonth(db);
  const earned = useMemo(() => earnedByMonth(db, settings), [db, settings]);
  const paidNow = paid.get(thisKey) ?? 0, paidPrev = paid.get(prevKey) ?? 0;
  // сравнение с тем же периодом прошлого месяца
  const day = now.getDate();
  const paidPrevSamePeriod = db.payments.filter((p) => monthKey(p.date) === prevKey && Number(p.date.slice(8)) <= day).reduce((s, p) => s + p.amount, 0);
  const diff = paidPrevSamePeriod ? Math.round(((paidNow - paidPrevSamePeriod) / paidPrevSamePeriod) * 100) : null;
  const expected = expectedForMonth(db, thisKey);
  const studentName = (id: string) => db.students.find((s) => s.id === id)?.full_name ?? "—";

  // группировка недели по дням
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <>
      <PageHeader
        title={<span className="inline-block first-letter:uppercase">{now.toLocaleDateString("ru-RU", { weekday: "long" })}, {now.getDate()} {MONTHS_GEN[now.getMonth()]}</span>}
        subtitle={settings.tutor_name ? `Добрый день, ${settings.tutor_name.split(" ")[0]}` : `На неделе ${weekLessons.length} ${plural(weekLessons.length, "занятие", "занятия", "занятий")}`}
        actions={<>
          <Button variant="secondary" icon="wallet" onClick={() => setPayFor("")}>Внести оплату</Button>
          <Button icon="plus" onClick={() => setLessonModal({})}>Занятие</Button>
        </>}
      />

      {/* Главный блок экрана — занятия на сегодня */}
      <section aria-labelledby="today" className="mb-8 rounded-3xl bg-ink p-5 text-paper sm:p-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="today" className="text-lg font-semibold">Сегодня</h2>
          <span className="text-sm text-paper/60">{todayLessons.length ? `${todayLessons.length} ${plural(todayLessons.length, "занятие", "занятия", "занятий")}` : "Свободный день"}</span>
        </div>
        {todayLessons.length ? (
          <ul className="mt-4 divide-y divide-paper/15">
            {todayLessons.map((l) => {
              const st = db.students.find((x) => x.id === l.student_id);
              const end = new Date(new Date(l.starts_at).getTime() + l.duration * 60000);
              const needs = l.status === "planned" && end < now;
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4 sm:flex-nowrap">
                  <button type="button" onClick={() => setLessonModal({ lesson: l })} className="flex min-w-0 basis-full items-center gap-5 text-left sm:flex-1 sm:basis-auto sm:gap-8">
                    <span className={`num text-[2.75rem] font-medium leading-none sm:text-6xl ${l.status.startsWith("cancelled") ? "text-paper/40 line-through" : ""}`}>{fmtTime(l.starts_at)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-semibold">{st?.full_name ?? "—"}</span>
                      <span className="block truncate text-sm text-paper/60">
                        {l.status === "done" ? "Проведено" : l.status !== "planned" ? LESSON_STATUS[l.status].label : needs ? "Закончилось, ждёт отметки" : `до ${fmtTime(end)}`}
                        {l.topic_ids.length ? `, ${topicNames(db, l.topic_ids).join(", ")}` : st?.goal ? `, ${st.goal}` : ""}
                      </span>
                    </span>
                  </button>
                  {l.status === "planned" && (
                    <button type="button" onClick={() => setLessonModal({ lesson: l, report: true })}
                      className="inline-flex h-11 items-center gap-2 rounded-full bg-paper px-5 text-sm font-medium text-ink transition-opacity hover:opacity-85">
                      <Icon name="check" className="w-[18px] h-[18px]" />Провести
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-md text-paper/70">Занятий нет. Можно подготовить материалы или поставить занятие.</p>
            <button type="button" onClick={() => setLessonModal({})} className="inline-flex h-11 items-center gap-2 rounded-full bg-paper px-5 text-sm font-medium text-ink">
              <Icon name="plus" className="w-[18px] h-[18px]" />Поставить занятие
            </button>
          </div>
        )}
      </section>

      <StatRow className="mb-10">
        <Stat label="Получено в этом месяце" value={rub(paidNow)}
          sub={diff == null ? `В прошлом месяце ${rub(paidPrev)}` : <span className={diff >= 0 ? "text-ink" : "text-signal"}>{diff >= 0 ? "+" : "−"}{Math.abs(diff)}% к тому же периоду прошлого месяца</span>} />
        <Stat label="Заработано за проведённые" value={rub(earned.get(thisKey) ?? 0)} sub={`Прошлый месяц ${rub(earned.get(prevKey) ?? 0)}`} />
        <Stat label="Ожидается до конца месяца" value={rub(expected)} sub="По запланированным занятиям" />
        <Stat label="Занятий на неделе" value={weekLessons.length} sub={`Проведено ${weekLessons.filter((l) => l.status === "done").length}`} />
      </StatRow>

      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {unmarked.length > 0 && (
            <Card title="Не отмечены прошедшие занятия">
              <div>{unmarked.slice(0, 5).map((l) => <LessonItem key={l.id} showDate lesson={l} onOpen={(x) => setLessonModal({ lesson: x })} onReport={(x) => setLessonModal({ lesson: x, report: true })} />)}</div>
            </Card>
          )}

          <Card title="Эта неделя" actions={<Link href="/schedule" className="text-sm text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">Расписание</Link>}>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-7">
              {days.map((d, i) => {
                const ls = weekLessons.filter((l) => ymd(new Date(l.starts_at)) === ymd(d));
                const isToday = ymd(d) === ymd(now);
                return (
                  <div key={i} className="bg-paper p-2.5 sm:min-h-[120px]">
                    <div className="mb-1 flex items-baseline justify-between text-xs sm:block">
                      <span className={cls("font-semibold", !isToday && "text-graphite")}>{WEEKDAYS_SHORT[i]}</span> <span className={cls("num inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1", isToday ? "bg-ink text-paper" : "text-graphite")}>{d.getDate()}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 sm:block sm:space-y-1">
                      {ls.length ? ls.map((l) => {
                        const s = db.students.find((x) => x.id === l.student_id);
                        return (
                          <button key={l.id} type="button" onClick={() => setLessonModal({ lesson: l })}
                            className={cls("block w-auto rounded-lg px-2 py-1.5 text-left text-xs sm:w-full", chipClass(l))}>
                            <span className="num block font-medium">{fmtTime(l.starts_at)}</span>
                            <span className="block truncate">{s?.full_name.split(" ")[1] ?? ""}</span>
                          </button>
                        );
                      }) : <span className="text-xs text-graphite/60">свободно</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Домашние задания: требуют внимания" actions={<Link href="/homework" className="text-sm text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">Все ДЗ</Link>}>
            {hwOpen.length ? (
              <ul className="divide-y divide-line">
                {hwOpen.slice(0, 8).map(({ h, eff }) => (
                  <li key={h.id}>
                    <button type="button" onClick={() => setHwId(h.id)} className="flex w-full items-center gap-3 py-2 text-left">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{h.title}</div>
                        <div className="text-xs text-graphite">{studentName(h.student_id)} · срок {fmtDate(h.due_date)}</div>
                      </div>
                      <Badge color={HW_STATUS[eff].color}>{eff === "submitted" ? "Ждёт проверки" : HW_STATUS[eff].label}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <Empty icon="checkCircle" title="Всё проверено" />}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Оплата" actions={<Link href="/finance" className="text-sm text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">Финансы</Link>}>
            {alerts.length ? (
              <ul className="space-y-2">
                {alerts.map((a) => (
                  <li key={a.student.id} className="flex items-center gap-2">
                    <Link href={`/students/view?id=${a.student.id}`} className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{a.student.full_name}</div>
                      <div className={`text-xs ${a.kind === "debt" ? "text-signal" : "text-amber-600"}`}>
                        {a.kind === "debt" ? `Долг ${rub(-a.balance)}` : a.text}
                      </div>
                    </Link>
                    <Button size="sm" variant="secondary" onClick={() => setPayFor(a.student.id)}>Оплата</Button>
                  </li>
                ))}
              </ul>
            ) : <Empty icon="wallet" title="Долгов нет" />}
          </Card>

          <Card title={`Давно не было проверки (>${settings.stale_check_days} дн.)`}>
            {stale.length ? (
              <ul className="space-y-2">
                {stale.map((x) => (
                  <li key={x.student.id}>
                    <Link href={`/students/view?id=${x.student.id}&tab=grades`} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{x.student.full_name}</span>
                      <span className="shrink-0 text-xs text-graphite">{x.last ? `${x.days} дн. назад` : "ни разу"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <Empty icon="target" title="У всех свежие результаты" />}
          </Card>
        </div>
      </div>

      {lessonModal && <LessonModal open lesson={lessonModal.lesson} report={lessonModal.report} onClose={() => setLessonModal(null)} />}
      {payFor != null && <PaymentModal open studentId={payFor} onClose={() => setPayFor(null)} />}
      {hwId && <HomeworkModal open hw={db.homework.find((h) => h.id === hwId)} onClose={() => setHwId(null)} />}
    </>
  );
}
