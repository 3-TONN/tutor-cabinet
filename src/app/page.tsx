"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Lesson } from "@/lib/types";
import {
  HW_STATUS, LESSON_STATUS, earnedByMonth, expectedForMonth, hwEffective, lessonsInRange, paidByMonth, paymentAlerts, staleStudents, topicNames,
} from "@/lib/logic";
import { addDays, addMonths, cls, fmtDate, fmtTime, monthKey, plural, rub, startOfDay, startOfWeek, ymd, WEEKDAYS_SHORT, MONTHS_GEN } from "@/lib/utils";
import { Badge, Button, Card, Empty, PageHeader, Select, Stat, StatRow } from "@/components/ui";
import { CourseChart } from "@/components/CourseChart";
import { LessonItem, chipClass } from "@/components/LessonItem";
import { HomeworkModal, LessonModal, PaymentModal } from "@/components/forms";
import { Icon } from "@/components/Icon";

export default function Dashboard() {
  const { db, settings } = useStore();
  const [lessonModal, setLessonModal] = useState<{ lesson?: Lesson; report?: boolean } | null>(null);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [hwId, setHwId] = useState<string | null>(null);
  const active = db.students.filter((x) => x.status === "active" && db.student_courses.some((c) => c.student_id === x.id));
  const [mapStudentId, setMapStudentId] = useState<string>("");
  const mapStudent = active.find((x) => x.id === mapStudentId) ?? active[0];

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
  const debtTotal = -alerts.filter((a) => a.kind === "debt").reduce((sum, a) => sum + a.balance, 0);
  const debtors = alerts.filter((a) => a.kind === "debt").length;
  const hwToCheck = hwOpen.filter((x) => x.eff === "submitted").length;
  const hwOverdue = hwOpen.filter((x) => x.eff === "overdue").length;
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

      {/* Главный блок экрана — занятия на сегодня: ячейки с крупным временем, текущее занятие инверсное */}
      <div className="mb-10 grid gap-x-6 gap-y-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.15fr)]">
      <section aria-labelledby="today">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="today" className="font-semibold">Сегодня</h2>
          <span className="num text-sm text-graphite">{todayLessons.length ? `${todayLessons.length} ${plural(todayLessons.length, "занятие", "занятия", "занятий")}` : "свободный день"}</span>
        </div>
        {todayLessons.length ? (
          <div className="flex flex-wrap gap-px overflow-hidden rounded-2xl border border-ink bg-ink">
            {todayLessons.map((l) => {
              const st = db.students.find((x) => x.id === l.student_id);
              const start = new Date(l.starts_at);
              const end = new Date(start.getTime() + l.duration * 60000);
              const live = l.status === "planned" && start <= now && now < end;
              const needs = l.status === "planned" && end < now;
              const nextUp = l.status === "planned" && !live && start > now && todayLessons.filter((x) => x.status === "planned" && new Date(x.starts_at) > now)[0]?.id === l.id;
              const inverse = live || (nextUp && !todayLessons.some((x) => x.status === "planned" && new Date(x.starts_at) <= now && now < new Date(new Date(x.starts_at).getTime() + x.duration * 60000)));
              const cancelled = l.status.startsWith("cancelled");
              return (
                <div key={l.id} className={cls("flex min-h-[10rem] min-w-[16rem] flex-1 basis-[18rem] flex-col justify-between gap-4 p-5", inverse ? "bg-ink text-paper" : "bg-paper")}>
                  <button type="button" onClick={() => setLessonModal({ lesson: l })} className="text-left">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={cls("num text-[2.75rem] font-medium leading-none tracking-tight sm:text-[3.25rem]", cancelled && "line-through opacity-50")}>{fmtTime(start)}</span>
                      <span className={cls("num text-xs", inverse ? "text-paper/70" : "text-graphite")}>до {fmtTime(end)}</span>
                    </div>
                    <div className="mt-3 truncate font-semibold">{st?.full_name ?? "—"}</div>
                    <div className={cls("truncate text-sm", inverse ? "text-paper/70" : "text-graphite")}>
                      {live ? "Идёт сейчас" : needs ? "Закончилось, ждёт отметки" : nextUp ? "Следующее" : l.status !== "planned" ? LESSON_STATUS[l.status].label : "Запланировано"}
                      {l.topic_ids.length ? ` · ${topicNames(db, l.topic_ids).join(", ")}` : ""}
                    </div>
                  </button>
                  {l.status === "planned" ? (
                    <button type="button" onClick={() => setLessonModal({ lesson: l, report: true })}
                      className={cls("inline-flex h-10 items-center gap-2 self-start rounded-full px-4 text-sm font-medium transition-colors",
                        inverse ? "bg-paper text-ink hover:bg-paper/85" : needs ? "bg-accent text-on-accent hover:bg-accent/90" : "ring-1 ring-inset ring-ink/25 hover:ring-ink")}>
                      <Icon name="check" className="w-[18px] h-[18px]" />Провести
                    </button>
                  ) : l.status === "done" ? (
                    <button type="button" onClick={() => setLessonModal({ lesson: l, report: true })}
                      className={cls("self-start text-sm font-medium hover:underline", inverse ? "text-paper" : "text-accent")}>
                      {(l.attachments ?? []).length ? `Материалы · ${l.attachments!.length}` : "Добавить материалы"}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-paper p-5">
            <p className="text-graphite">Занятий сегодня нет. Можно подготовить материалы или поставить занятие.</p>
            <Button icon="plus" onClick={() => setLessonModal({})}>Поставить занятие</Button>
          </div>
        )}
      </section>

      <section aria-labelledby="summary">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="summary" className="font-semibold">Сводка</h2>
          <span className="num text-sm text-graphite">{MONTHS_GEN[now.getMonth()]}</span>
        </div>
        <StatRow wide={false}>
          <Stat label="Получено" value={rub(paidNow)}
            sub={diff == null ? `Прошлый месяц ${rub(paidPrev)}` : <span className={diff >= 0 ? "text-ink" : "text-signal"}>{diff >= 0 ? "+" : "−"}{Math.abs(diff)}% к прошлому месяцу</span>} />
          <Stat label="Ожидается" value={rub(expected)} sub="По расписанию" />
          <Stat label="Долги" value={rub(debtTotal)} tone={debtTotal > 0 ? "bad" : undefined} sub={debtors ? `${debtors} ${plural(debtors, "ученик", "ученика", "учеников")}` : "Все оплатили"} />
          <Stat label="ДЗ на проверку" value={hwToCheck} tone={hwOverdue > 0 ? "bad" : undefined} sub={hwOverdue ? `Просрочено ${hwOverdue}` : "Просрочек нет"} />
          <Stat label="Заработано" value={rub(earned.get(thisKey) ?? 0)} sub={`Прошлый месяц ${rub(earned.get(prevKey) ?? 0)}`} />
          <Stat label="За неделю" value={weekLessons.length} sub={`${plural(weekLessons.length, "занятие", "занятия", "занятий")}, проведено ${weekLessons.filter((l) => l.status === "done").length}`} />
        </StatRow>
      </section>
      </div>

      {mapStudent && (
        <Card className="mb-10" title="Карта курса" actions={
          <Select aria-label="Ученик для карты курса" className="h-9 w-auto py-1 text-sm" value={mapStudent.id} onChange={(e) => setMapStudentId(e.target.value)}>
            {active.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}
          </Select>
        }>
          <CourseChart key={mapStudent.id} studentId={mapStudent.id} />
        </Card>
      )}

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
                      <div className={`text-xs ${a.kind === "debt" ? "text-signal" : "text-ink"}`}>
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
