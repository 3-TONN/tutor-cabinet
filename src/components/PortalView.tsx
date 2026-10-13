"use client";

// Личный кабинет ученика / родителя — только просмотр.

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { homeworkStats, hwEffective, ledger, progress, topicNames } from "@/lib/logic";
import { fmtDate, fmtTime, rub } from "@/lib/utils";
import { Avatar, Button, Card, Empty, Progress, Select, Tabs } from "./ui";
import { GradesTab, HomeworkTab, LessonsTab, PaymentsTab, TopicsTab } from "./student-tabs";
import { Icon } from "./Icon";
import { useTheme } from "./Providers";

type Tab = "home" | "lessons" | "topics" | "grades" | "homework" | "payments";

export function PortalView({ studentIds, demo, onExit, exitLabel }: { studentIds: string[]; demo?: boolean; onExit: () => void; exitLabel: string }) {
  const { db, settings } = useStore();
  const { theme, setTheme } = useTheme();
  const [sid, setSid] = useState(studentIds[0] ?? "");
  const [tab, setTab] = useState<Tab>("home");
  const s = db.students.find((x) => x.id === sid);
  const lg = useMemo(() => (s ? ledger(db, s.id, settings) : null), [db, s, settings]);

  if (!s || !lg)
    return (
      <div className="mx-auto max-w-md p-6 pt-20">
        <Empty icon="users" title="Доступ не найден" text="Ваш e-mail не привязан ни к одному ученику. Попросите репетитора добавить его в карточку ученика (поле «E-mail для личного кабинета»)." action={<Button onClick={onExit}>{exitLabel}</Button>} />
      </div>
    );

  const now = new Date().toISOString();
  const upcoming = db.lessons.filter((l) => l.student_id === s.id && l.status === "planned" && l.starts_at >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const pr = progress(db, s.id);
  const hw = homeworkStats(db, s.id);
  const openHw = db.homework.filter((h) => h.student_id === s.id && (hwEffective(h) === "assigned" || hwEffective(h) === "overdue")).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const lastDone = db.lessons.filter((l) => l.student_id === s.id && l.status === "done").sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];

  return (
    <div className="min-h-screen">
      {demo && (
        <div className="no-print sticky top-0 z-40 flex items-center justify-center gap-3 bg-amber-100 px-4 py-2 text-sm text-amber-900">
          <Icon name="eye" className="w-4 h-4" />Так видит кабинет ученик или родитель
          <button type="button" className="font-semibold underline" onClick={onExit}>{exitLabel}</button>
        </div>
      )}
      <div className="mx-auto max-w-4xl px-4 pb-16 pt-5 sm:px-6">
        <header className="mb-5 flex flex-wrap items-center gap-3">
          <Avatar name={s.full_name} color={s.color} size={44} />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold">{s.full_name}</h1>
            <p className="text-sm text-graphite">{[s.grade && `${s.grade} класс`, s.goal].filter(Boolean).join(" · ")}{settings.tutor_name && ` · преподаватель: ${settings.tutor_name}`}</p>
          </div>
          {studentIds.length > 1 && (
            <Select className="w-auto" value={sid} onChange={(e) => setSid(e.target.value)}>
              {studentIds.map((id) => <option key={id} value={id}>{db.students.find((x) => x.id === id)?.full_name}</option>)}
            </Select>
          )}
          <button type="button" className="rounded-lg p-2 text-graphite hover:bg-mist" aria-label="Тема" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            <Icon name={theme === "dark" ? "moon" : "sun"} />
          </button>
          {!demo && <Button variant="ghost" icon="logout" onClick={onExit}>{exitLabel}</Button>}
        </header>

        <Tabs<Tab> value={tab} onChange={setTab} tabs={[
          { id: "home", label: "Главное" }, { id: "lessons", label: "Расписание" }, { id: "topics", label: "Прогресс" },
          { id: "grades", label: "Оценки" }, { id: "homework", label: "Домашние задания" }, { id: "payments", label: "Оплата" },
        ]} />
        <div className="mt-4">
          {tab === "home" && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card title="Ближайшие занятия">
                {upcoming.length ? (
                  <ul className="space-y-2">
                    {upcoming.slice(0, 5).map((l) => (
                      <li key={l.id} className="flex items-center gap-2 text-sm">
                        <Icon name="calendar" className="w-4 h-4 text-graphite" />
                        <span className="first-letter:uppercase">{new Date(l.starts_at).toLocaleDateString("ru-RU", { weekday: "long" })}, {fmtDate(l.starts_at)}</span>
                        <b className="ml-auto">{fmtTime(l.starts_at)}</b>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-graphite">Занятий пока не запланировано</p>}
              </Card>
              <Card title="Баланс">
                <div className={`text-2xl font-semibold ${lg.balance < 0 ? "text-signal" : ""}`}>{lg.balance < 0 ? `К оплате ${rub(-lg.balance)}` : rub(lg.balance)}</div>
                <p className="text-sm text-graphite">{lg.balance < 0 ? "Задолженность за проведённые занятия" : lg.balance > 0 ? "Предоплата" : "Расчёт закрыт"}</p>
                {lg.activeSub && <p className="mt-2 text-sm">Абонемент: осталось <b>{lg.activeSub.left}</b> из {lg.activeSub.sub.lessons_total} занятий (до {fmtDate(lg.activeSub.sub.expires_at)})</p>}
              </Card>
              <Card title="Прогресс по программе">
                {pr.total ? (
                  <>
                    <div className="mb-2 text-2xl font-semibold">{Math.round(pr.percent)}%</div>
                    <Progress value={pr.percent} className="h-3" />
                    <p className="mt-2 text-sm text-graphite">Пройдено {pr.covered} из {pr.total} тем</p>
                  </>
                ) : <p className="text-sm text-graphite">Программа ещё не назначена</p>}
              </Card>
              <Card title="Домашние задания">
                <p className="mb-2 text-sm">Выполнено: <b>{hw.rate == null ? "—" : `${Math.round(hw.rate)}%`}</b></p>
                {openHw.length ? (
                  <ul className="space-y-1.5">
                    {openHw.map((h) => (
                      <li key={h.id} className="text-sm">
                        <span className={hwEffective(h) === "overdue" ? "text-signal" : ""}>{h.title}</span>
                        <span className="text-graphite"> — до {fmtDate(h.due_date)}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-graphite">Невыполненных заданий нет 👍</p>}
              </Card>
              {lastDone && (
                <Card title={`Последнее занятие · ${fmtDate(lastDone.starts_at)}`} className="md:col-span-2">
                  {lastDone.topic_ids.length > 0 && <p className="text-sm"><b>Темы:</b> {topicNames(db, lastDone.topic_ids).join(", ")}</p>}
                  {lastDone.report_covered && <p className="text-sm"><b>Прошли:</b> {lastDone.report_covered}</p>}
                  {lastDone.report_homework && <p className="text-sm"><b>Задано:</b> {lastDone.report_homework}</p>}
                  {lastDone.comment && <p className="mt-1 text-sm italic text-graphite">{lastDone.comment}</p>}
                </Card>
              )}
            </div>
          )}
          {tab === "lessons" && <LessonsTab studentId={s.id} readOnly />}
          {tab === "topics" && <TopicsTab studentId={s.id} readOnly />}
          {tab === "grades" && <GradesTab studentId={s.id} readOnly />}
          {tab === "homework" && <HomeworkTab studentId={s.id} readOnly />}
          {tab === "payments" && <PaymentsTab studentId={s.id} readOnly />}
        </div>
      </div>
    </div>
  );
}
