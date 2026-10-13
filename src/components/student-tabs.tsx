"use client";

// Вкладки карточки ученика. Используются и в кабинете репетитора, и (в режиме readOnly) в личном кабинете ученика.

import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Assessment, Homework, Lesson, Payment, TopicStatus } from "@/lib/types";
import {
  ASSESSMENT_KIND, HW_STATUS, LESSON_STATUS, PAYMENT_KIND, PAYMENT_METHOD, TOPIC_STATUS, TOPIC_STATUS_ORDER, assessmentPercent,
  convertScore, homeworkStats, hwEffective, ledger, progress, studentTopicList, topicNames, topicScores, topicStatus, weakTopics,
} from "@/lib/logic";
import { fmtDate, fmtDateTime, fmtTime, rub, todayYmd, uid, plural } from "@/lib/utils";
import { Badge, Button, Card, Empty, Progress, Segmented, Select, Table, Textarea, useConfirm } from "./ui";
import { AssessmentModal, Attachments, HomeworkModal, LessonModal, PaymentModal } from "./forms";
import { BarChart, HBars, LineChart } from "./Charts";
import { Icon } from "./Icon";

// ---------------------------------------------------------------- Занятия

export function LessonsTab({ studentId, readOnly }: { studentId: string; readOnly?: boolean }) {
  const { db, settings } = useStore();
  const [mode, setMode] = useState<"future" | "past">("future");
  const [modal, setModal] = useState<{ lesson?: Lesson; report?: boolean } | null>(null);
  const now = new Date().toISOString();
  const lg = useMemo(() => ledger(db, studentId, settings), [db, studentId, settings]);
  const all = db.lessons.filter((l) => l.student_id === studentId);
  const list = all
    .filter((l) => (mode === "future" ? l.starts_at >= now && l.status === "planned" : l.starts_at < now || l.status !== "planned"))
    .sort((a, b) => (mode === "future" ? a.starts_at.localeCompare(b.starts_at) : b.starts_at.localeCompare(a.starts_at)));
  const series = db.lesson_series.filter((s) => s.student_id === studentId && s.end_date >= todayYmd());
  const WD = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented value={mode} onChange={setMode} options={[{ id: "future", label: `Предстоящие` }, { id: "past", label: "Прошедшие" }]} />
        {!readOnly && <Button icon="plus" onClick={() => setModal({})}>Занятие</Button>}
      </div>
      {series.length > 0 && (
        <p className="flex items-center gap-1.5 text-sm text-graphite"><Icon name="repeat" className="w-4 h-4" />
          Регулярно: {series.map((s) => `${WD[s.weekday]} ${s.time}`).join(", ")} (до {fmtDate(series[0].end_date)})
        </p>
      )}
      {list.length ? (
        <div className="space-y-2">
          {list.slice(0, 60).map((l) => {
            const charge = lg.charges.get(l.id);
            return (
              <button key={l.id} type="button" disabled={readOnly} onClick={() => setModal({ lesson: l })}
                className="block w-full rounded-lg border border-line bg-surface p-3 text-left disabled:cursor-default">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold tabular-nums">{fmtDate(l.starts_at)} {fmtTime(l.starts_at)}</span>
                  <Badge color={LESSON_STATUS[l.status].color}>{LESSON_STATUS[l.status].label}</Badge>
                  {l.grade != null && <Badge color="violet">оценка {l.grade}</Badge>}
                  <span className="ml-auto text-xs text-graphite">{charge ? (charge.subscription_id ? "по абонементу" : rub(charge.amount)) : ""}</span>
                </div>
                {l.topic_ids.length > 0 && <div className="mt-1 text-sm">{topicNames(db, l.topic_ids).join(", ")}</div>}
                {l.report_covered && <div className="mt-1 text-sm text-graphite dark:text-graphite">Прошли: {l.report_covered}</div>}
                {l.report_homework && <div className="text-sm text-graphite dark:text-graphite">Задано: {l.report_homework}</div>}
                {l.comment && <div className="mt-1 text-xs italic text-graphite">{l.comment}</div>}
                {!readOnly && l.status === "planned" && l.starts_at < now && (
                  <span className="mt-2 inline-block text-xs font-medium text-amber-600">Нажмите, чтобы отметить занятие</span>
                )}
              </button>
            );
          })}
        </div>
      ) : <Empty icon="calendar" title={mode === "future" ? "Нет запланированных занятий" : "Пока нет прошедших занятий"} />}
      {modal && <LessonModal open lesson={modal.lesson} report={modal.lesson?.status === "planned" && modal.lesson.starts_at < now} preset={{ student_id: studentId }} onClose={() => setModal(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- Темы

export function TopicsTab({ studentId, readOnly }: { studentId: string; readOnly?: boolean }) {
  const { db, insert, update, remove } = useStore();
  const confirm = useConfirm();
  const [open, setOpen] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const assigned = db.student_courses.filter((c) => c.student_id === studentId);
  const topics = studentTopicList(db, studentId);
  const pr = progress(db, studentId);
  const scores = useMemo(() => topicScores(db, studentId), [db, studentId]);
  const free = db.courses.filter((c) => !assigned.some((a) => a.course_id === c.id));

  const setStatus = async (topicId: string, status: TopicStatus) => {
    const ex = db.student_topics.find((x) => x.student_id === studentId && x.topic_id === topicId);
    if (ex) await update("student_topics", ex.id, { status, updated_at: todayYmd() });
    else await insert("student_topics", { id: uid(), student_id: studentId, topic_id: topicId, status, updated_at: todayYmd() });
  };
  const unassign = async (id: string, name: string) => {
    if (await confirm({ title: "Убрать программу?", text: `Программа «${name}» будет отвязана от ученика. Статусы тем сохранятся, если назначить её снова.`, ok: "Убрать" }))
      await remove("student_courses", id);
  };

  const counts = TOPIC_STATUS_ORDER.map((s) => ({ s, n: topics.filter((t) => topicStatus(db, studentId, t.id) === s).length }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {assigned.map((a) => {
          const c = db.courses.find((x) => x.id === a.course_id);
          return (
            <Badge key={a.id} color="teal" className="gap-1 py-1 text-sm">
              {c?.name}
              {!readOnly && <button type="button" aria-label="Убрать" onClick={() => unassign(a.id, c?.name ?? "")}><Icon name="x" className="w-3.5 h-3.5" /></button>}
            </Badge>
          );
        })}
        {!readOnly && free.length > 0 && (
          <Select className="w-auto" value="" onChange={(e) => e.target.value && insert("student_courses", { id: uid(), student_id: studentId, course_id: e.target.value })}>
            <option value="">+ Назначить программу</option>
            {free.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        )}
        {!readOnly && !db.courses.length && <Link href="/topics" className="text-sm text-ink underline underline-offset-4">Создайте программу в разделе «Программа»</Link>}
      </div>

      {topics.length > 0 ? (
        <>
          <Card>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <div className="text-3xl font-semibold">{Math.round(pr.percent)}%</div>
                <div className="text-xs text-graphite">программы пройдено ({pr.covered} из {pr.total} {plural(pr.total, "темы", "тем", "тем")})</div>
              </div>
              <div className="min-w-[200px] flex-1"><Progress value={pr.percent} className="h-3" /></div>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              {counts.map(({ s, n }) => (
                <span key={s} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${TOPIC_STATUS[s].cell}`} />{TOPIC_STATUS[s].label}: {n}</span>
              ))}
            </div>
          </Card>
          <div className="flex justify-end"><Segmented value={view} onChange={setView} options={[{ id: "list", label: "Список" }, { id: "map", label: "Карта" }]} /></div>

          {view === "map" ? (
            <Card>
              {[...new Set(topics.map((t) => t.section))].map((sec) => (
                <div key={sec} className="mb-3">
                  <div className="mb-1.5 text-xs font-semibold text-graphite">{sec}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {topics.filter((t) => t.section === sec).map((t) => {
                      const st = topicStatus(db, studentId, t.id);
                      const sc = scores.get(t.id);
                      return (
                        <div key={t.id} title={`${t.name}: ${TOPIC_STATUS[st].label}${sc ? `, ${Math.round(sc.avg)}%` : ""}`}
                          className={`rounded-md px-2 py-1.5 text-xs font-medium ${TOPIC_STATUS[st].cell}`}>
                          {t.name}{sc ? ` · ${Math.round(sc.avg)}%` : ""}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </Card>
          ) : (
            [...new Set(topics.map((t) => `${t.course_id}|${t.section}`))].map((key) => {
              const [cid, sec] = key.split("|");
              const list = topics.filter((t) => t.course_id === cid && t.section === sec);
              return (
                <Card key={key} title={<span>{sec} <span className="text-xs font-normal text-graphite">{assigned.length > 1 ? db.courses.find((c) => c.id === cid)?.name : ""}</span></span>} padded={false}>
                  <ul className="divide-y divide-line">
                    {list.map((t) => {
                      const st = topicStatus(db, studentId, t.id);
                      const sc = scores.get(t.id);
                      const lessons = db.lessons.filter((l) => l.student_id === studentId && l.topic_ids.includes(t.id)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
                      const tests = db.assessments.filter((a) => a.student_id === studentId && (a.topic_ids.includes(t.id) || a.topic_results?.[t.id] != null));
                      return (
                        <li key={t.id} className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className={`h-3 w-3 shrink-0 rounded-full ${TOPIC_STATUS[st].cell}`} />
                            <button type="button" onClick={() => setOpen(open === t.id ? null : t.id)} className="min-w-0 flex-1 truncate text-left text-sm">
                              {t.name}
                              {sc && <span className={`ml-2 text-xs ${sc.avg < 70 ? "text-signal" : "text-graphite"}`}>{Math.round(sc.avg)}%</span>}
                            </button>
                            {readOnly ? <Badge color={TOPIC_STATUS[st].color}>{TOPIC_STATUS[st].label}</Badge> : (
                              <Select className="w-44 py-1 text-xs" value={st} onChange={(e) => setStatus(t.id, e.target.value as TopicStatus)}>
                                {TOPIC_STATUS_ORDER.map((s) => <option key={s} value={s}>{TOPIC_STATUS[s].label}</option>)}
                              </Select>
                            )}
                          </div>
                          {open === t.id && (
                            <div className="mt-2 space-y-1 pl-5 text-xs text-graphite">
                              {lessons.length ? lessons.map((l) => <div key={l.id}>Занятие {fmtDate(l.starts_at)}{l.report_covered ? ` — ${l.report_covered}` : ""}</div>) : <div>На занятиях тема ещё не отмечалась</div>}
                              {tests.map((a) => {
                                const p = a.topic_results?.[t.id] ?? assessmentPercent(a);
                                return <div key={a.id}>Проверка {fmtDate(a.date)} «{a.title}»: {Math.round(p)}%</div>;
                              })}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              );
            })
          )}
        </>
      ) : <Empty icon="book" title="Программа не назначена" text="Назначьте ученику программу, чтобы отслеживать пройденные темы." />}
    </div>
  );
}

// ---------------------------------------------------------------- Оценки / контроль знаний

export function GradesTab({ studentId, readOnly }: { studentId: string; readOnly?: boolean }) {
  const { db, settings } = useStore();
  const [modal, setModal] = useState<{ a?: Assessment } | null>(null);
  const list = db.assessments.filter((a) => a.student_id === studentId).sort((a, b) => b.date.localeCompare(a.date));
  const regular = [...list].reverse().filter((a) => a.kind !== "exam");
  const exams = [...list].reverse().filter((a) => a.kind === "exam");
  const scores = useMemo(() => topicScores(db, studentId), [db, studentId]);
  const weak = useMemo(() => weakTopics(db, studentId, settings), [db, studentId, settings]);
  const topicRows = [...scores.entries()]
    .map(([tid, e]) => ({ label: db.topics.find((t) => t.id === tid)?.name ?? "", value: e.avg, sub: `${e.values.length} ${plural(e.values.length, "проверка", "проверки", "проверок")}` }))
    .filter((r) => r.label)
    .sort((a, b) => a.value - b.value);
  const scaleOf = (a: Assessment) => settings.exam_scales.find((s) => s.key === a.exam_scale);

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex flex-wrap justify-end gap-2">
          <Link href={`/tests/run?student=${studentId}`}><Button variant="secondary" icon="play">Провести тест</Button></Link>
          <Button icon="plus" onClick={() => setModal({})}>Результат</Button>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Динамика результатов, %">
          <LineChart points={regular.map((a) => ({ x: fmtDate(a.date).slice(0, 5), y: assessmentPercent(a), label: a.title }))} />
        </Card>
        <Card title="Пробные экзамены">
          {exams.length ? (
            <>
              <BarChart bars={exams.map((a) => ({ label: fmtDate(a.date).slice(0, 5), value: convertScore(scaleOf(a), a.score) ?? a.score }))} height={150} />
              <ul className="mt-2 space-y-1 text-sm">
                {exams.map((a) => {
                  const sc = scaleOf(a);
                  const conv = convertScore(sc, a.score);
                  return <li key={a.id} className="flex justify-between gap-2"><span className="truncate">{a.title} · {fmtDate(a.date)}</span><span className="shrink-0 tabular-nums">{a.score}/{a.max_score} перв.{conv != null && <b> → {conv}{sc?.name.includes("оценка") ? " (оценка)" : ""}</b>}</span></li>;
                })}
              </ul>
            </>
          ) : <Empty icon="target" title="Пробников пока не было" />}
        </Card>
        <Card title="Результаты по темам">
          <HBars rows={topicRows} threshold={settings.weak_threshold} />
        </Card>
        <Card title={`Слабые темы (ниже ${settings.weak_threshold}%)`}>
          {weak.length ? (
            <ul className="space-y-1.5">
              {weak.map((w) => <li key={w.topic.id} className="flex justify-between text-sm"><span>{w.topic.name}</span><Badge color={w.avg < 50 ? "red" : "amber"}>{Math.round(w.avg)}%</Badge></li>)}
            </ul>
          ) : <Empty icon="checkCircle" title="Слабых тем нет" text="Все темы выше порога." />}
        </Card>
      </div>
      <Card title="Все проверки" padded={false}>
        {list.length ? (
          <Table head={["Дата", "Название", "Вид", "Баллы", "%", "Темы"]}>
            {list.map((a) => (
              <tr key={a.id} className={readOnly ? "" : "cursor-pointer hover:bg-mist"} onClick={() => !readOnly && setModal({ a })}>
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(a.date)}</td>
                <td className="px-3 py-2">{a.title}{a.comment && <div className="text-xs text-graphite">{a.comment}</div>}</td>
                <td className="px-3 py-2 whitespace-nowrap">{ASSESSMENT_KIND[a.kind]}</td>
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">{a.score}/{a.max_score}{a.kind === "exam" && convertScore(scaleOf(a), a.score) != null && ` → ${convertScore(scaleOf(a), a.score)}`}</td>
                <td className="px-3 py-2"><Badge color={assessmentPercent(a) >= settings.weak_threshold ? "green" : assessmentPercent(a) >= 50 ? "amber" : "red"}>{Math.round(assessmentPercent(a))}%</Badge></td>
                <td className="px-3 py-2 text-xs text-graphite">{topicNames(db, a.topic_ids).join(", ")}</td>
              </tr>
            ))}
          </Table>
        ) : <Empty icon="target" title="Проверок пока не было" />}
      </Card>
      {modal && <AssessmentModal open a={modal.a} studentId={studentId} onClose={() => setModal(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- ДЗ

export function HomeworkTab({ studentId, readOnly }: { studentId: string; readOnly?: boolean }) {
  const { db, update } = useStore();
  const [modal, setModal] = useState<{ h?: Homework } | null>(null);
  const stats = homeworkStats(db, studentId);
  const list = db.homework.filter((h) => h.student_id === studentId).sort((a, b) => b.due_date.localeCompare(a.due_date));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="text-sm">Выполнено: <b>{stats.rate == null ? "—" : `${Math.round(stats.rate)}%`}</b> ({stats.done} из {stats.done + stats.failed})</div>
        {stats.avgGrade != null && <div className="text-sm">Средняя оценка: <b>{stats.avgGrade.toFixed(1)}</b></div>}
        {!readOnly && <Button className="ml-auto" icon="plus" onClick={() => setModal({})}>Задание</Button>}
      </div>
      {list.length ? (
        <div className="space-y-2">
          {list.map((h) => {
            const eff = hwEffective(h);
            return (
              <div key={h.id} className="rounded-lg border border-line bg-surface p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" disabled={readOnly} onClick={() => setModal({ h })} className="min-w-0 flex-1 text-left">
                    <div className="font-medium">{h.title}</div>
                    <div className="text-xs text-graphite">Выдано {fmtDate(h.assigned_at)} · срок {fmtDate(h.due_date)}{h.topic_ids.length ? ` · ${topicNames(db, h.topic_ids).join(", ")}` : ""}</div>
                  </button>
                  <Badge color={HW_STATUS[eff].color}>{HW_STATUS[eff].label}</Badge>
                  {h.grade != null && <Badge color="violet">{h.grade}</Badge>}
                </div>
                {h.description && <p className="mt-1.5 whitespace-pre-line text-sm text-graphite dark:text-graphite">{h.description}</p>}
                {h.attachments.length > 0 && <div className="mt-2"><Attachments value={h.attachments} readOnly /></div>}
                {h.comment && <p className="mt-1 text-xs italic text-graphite">Комментарий: {h.comment}</p>}
                {!readOnly && (eff === "assigned" || eff === "overdue" || eff === "submitted") && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {eff !== "submitted" && <Button size="sm" variant="secondary" onClick={() => update("homework", h.id, { status: "submitted" })}>Сдано</Button>}
                    <Button size="sm" variant="secondary" onClick={() => setModal({ h: { ...h, status: "checked" } })}>Проверить</Button>
                    {eff === "overdue" && <Button size="sm" variant="ghost" onClick={() => update("homework", h.id, { status: "missed" })}>Не сдано</Button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : <Empty icon="clipboard" title="Домашних заданий пока нет" />}
      {modal && <HomeworkModal open hw={modal.h} studentId={studentId} onClose={() => setModal(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- Оплаты

export function PaymentsTab({ studentId, readOnly }: { studentId: string; readOnly?: boolean }) {
  const { db, settings } = useStore();
  const [modal, setModal] = useState<{ p?: Payment } | null>(null);
  const lg = useMemo(() => ledger(db, studentId, settings), [db, studentId, settings]);
  const payments = db.payments.filter((p) => p.student_id === studentId).sort((a, b) => b.date.localeCompare(a.date));
  const charged = db.lessons.filter((l) => lg.charges.has(l.id)).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const [show, setShow] = useState<"payments" | "charges">("payments");
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="text-xs text-graphite">Баланс</div>
          <div className={`text-2xl font-semibold ${lg.balance < 0 ? "text-signal" : ""}`}>{rub(lg.balance)}</div>
          <div className="text-xs text-graphite">{lg.balance < 0 ? "Задолженность" : lg.balance > 0 ? "Предоплата" : "Расчёт закрыт"}</div>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="text-xs text-graphite">Оплачено всего</div>
          <div className="text-2xl font-semibold">{rub(lg.paid)}</div>
          <div className="text-xs text-graphite">Списано за занятия: {rub(lg.charged)}</div>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="text-xs text-graphite">Абонемент</div>
          {lg.activeSub ? (
            <>
              <div className="text-2xl font-semibold">{lg.activeSub.left} из {lg.activeSub.sub.lessons_total}</div>
              <div className={`text-xs ${lg.activeSub.left <= 1 ? "text-amber-600" : "text-graphite"}`}>осталось занятий · до {fmtDate(lg.activeSub.sub.expires_at)}</div>
            </>
          ) : <div className="mt-1 text-sm text-graphite">Нет действующего абонемента</div>}
        </div>
      </div>
      {lg.subs.length > 0 && (
        <Card title="Абонементы" padded={false}>
          <Table head={["Период", "Занятий", "Использовано", "Стоимость", ""]}>
            {[...lg.subs].reverse().map((u) => (
              <tr key={u.sub.id}>
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(u.sub.start_date)} – {fmtDate(u.sub.expires_at)}</td>
                <td className="px-3 py-2">{u.sub.lessons_total}</td>
                <td className="px-3 py-2">{u.used}</td>
                <td className="px-3 py-2 whitespace-nowrap">{rub(u.sub.price_total)}</td>
                <td className="px-3 py-2">{u.left === 0 ? <Badge>Использован</Badge> : u.expired ? <Badge color="red">Истёк ({u.left} не исп.)</Badge> : <Badge color="green">Действует</Badge>}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented value={show} onChange={setShow} options={[{ id: "payments", label: "Оплаты" }, { id: "charges", label: "Списания" }]} />
        {!readOnly && <Button icon="plus" onClick={() => setModal({})}>Внести оплату</Button>}
      </div>
      {show === "payments" ? (
        payments.length ? (
          <Card padded={false}>
            <Table head={["Дата", "Сумма", "За что", "Способ", "Комментарий"]}>
              {payments.map((p) => (
                <tr key={p.id} className={readOnly ? "" : "cursor-pointer hover:bg-mist"} onClick={() => !readOnly && setModal({ p })}>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(p.date)}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-medium tabular-nums">{rub(p.amount)}</td>
                  <td className="px-3 py-2">{PAYMENT_KIND[p.kind]}</td>
                  <td className="px-3 py-2">{PAYMENT_METHOD[p.method]}</td>
                  <td className="px-3 py-2 text-graphite">{p.comment}</td>
                </tr>
              ))}
            </Table>
          </Card>
        ) : <Empty icon="wallet" title="Оплат пока нет" />
      ) : (
        <Card padded={false}>
          <Table head={["Занятие", "Статус", "Списано"]}>
            {charged.map((l) => {
              const c = lg.charges.get(l.id)!;
              return (
                <tr key={l.id}>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDateTime(l.starts_at)}</td>
                  <td className="px-3 py-2">{LESSON_STATUS[l.status].label}{l.late_cancel ? " (поздно)" : ""}</td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{rub(c.amount)}{c.subscription_id ? " · абонемент" : ""}</td>
                </tr>
              );
            })}
          </Table>
        </Card>
      )}
      {modal && <PaymentModal open payment={modal.p} studentId={studentId} onClose={() => setModal(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- Заметки

export function NotesTab({ studentId }: { studentId: string }) {
  const { db, insert, remove, update } = useStore();
  const confirm = useConfirm();
  const student = db.students.find((s) => s.id === studentId)!;
  const [text, setText] = useState("");
  const [general, setGeneral] = useState(student.notes);
  const notes = db.notes.filter((n) => n.student_id === studentId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const add = async () => {
    if (!text.trim()) return;
    await insert("notes", { id: uid(), student_id: studentId, text: text.trim(), created_at: new Date().toISOString() });
    setText("");
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Особенности ученика">
        <Textarea rows={6} value={general} onChange={(e) => setGeneral(e.target.value)} placeholder="Что получается, что нет, как лучше заниматься…" />
        {general !== student.notes && <Button className="mt-2" onClick={() => update("students", studentId, { notes: general })}>Сохранить</Button>}
      </Card>
      <Card title="Быстрые заметки">
        <div className="flex gap-2">
          <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Новая заметка…" onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && add()} />
          <Button icon="plus" onClick={add} disabled={!text.trim()} aria-label="Добавить" />
        </div>
        <ul className="mt-3 space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="group rounded-lg bg-amber-50 p-3 text-sm">
              <div className="flex items-start gap-2">
                <p className="flex-1 whitespace-pre-line">{n.text}</p>
                <button type="button" className="text-graphite hover:text-signal" aria-label="Удалить"
                  onClick={async () => (await confirm({ title: "Удалить заметку?", text: n.text.slice(0, 120) })) && remove("notes", n.id)}>
                  <Icon name="trash" className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-1 text-xs text-graphite">{fmtDateTime(n.created_at)}</div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
