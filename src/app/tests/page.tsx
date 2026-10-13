"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Assessment, Question, QuestionType, Quiz } from "@/lib/types";
import { ASSESSMENT_KIND, assessmentPercent, convertScore, lastAssessmentDate, topicNames, weakTopics } from "@/lib/logic";
import { fmtDate, sum, uid } from "@/lib/utils";
import { Badge, Button, Card, Empty, Field, IconButton, Input, Modal, MultiPick, PageHeader, Select, Table, Tabs, Textarea, useConfirm } from "@/components/ui";
import { AssessmentModal, StudentSelect, topicOptions } from "@/components/forms";
import { Icon } from "@/components/Icon";

type Tab = "results" | "quizzes" | "weak";

export default function TestsPage() {
  const { db, settings, remove } = useStore();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("results");
  const [sid, setSid] = useState("");
  const [kind, setKind] = useState("");
  const [modal, setModal] = useState<{ a?: Assessment } | null>(null);
  const [quizModal, setQuizModal] = useState<{ q?: Quiz } | null>(null);
  const list = db.assessments.filter((a) => (!sid || a.student_id === sid) && (!kind || a.kind === kind)).sort((a, b) => b.date.localeCompare(a.date));
  const name = (id: string) => db.students.find((s) => s.id === id)?.full_name ?? "—";
  const active = db.students.filter((s) => s.status === "active");
  const weak = useMemo(() => active.map((s) => ({ s, weak: weakTopics(db, s.id, settings), last: lastAssessmentDate(db, s.id) })), [db, settings, active]);

  return (
    <>
      <PageHeader title="Контроль знаний" subtitle="Проверочные, тесты, пробные экзамены"
        actions={<>
          <Link href="/tests/run"><Button variant="secondary" icon="play">Провести тест</Button></Link>
          <Button icon="plus" onClick={() => setModal({})}>Результат</Button>
        </>} />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: "results", label: "Результаты", count: db.assessments.length }, { id: "quizzes", label: "Тесты в приложении", count: db.quizzes.length }, { id: "weak", label: "Слабые темы" }]} />
      <div className="mt-4">
        {tab === "results" && (
          <>
            <div className="mb-4 grid gap-2 sm:grid-cols-3">
              <StudentSelect value={sid} onChange={setSid} allowEmpty="Все ученики" includeInactive />
              <Select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">Все виды</option>{Object.entries(ASSESSMENT_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
            {list.length ? (
              <Card padded={false}>
                <Table head={["Дата", "Ученик", "Название", "Вид", "Баллы", "%", ""]}>
                  {list.map((a) => {
                    const p = assessmentPercent(a);
                    const sc = settings.exam_scales.find((x) => x.key === a.exam_scale);
                    return (
                      <tr key={a.id} className="cursor-pointer hover:bg-mist" onClick={() => setModal({ a })}>
                        <td className="px-3 py-2 whitespace-nowrap">{fmtDate(a.date)}</td>
                        <td className="px-3 py-2">{name(a.student_id)}</td>
                        <td className="px-3 py-2">{a.title}<div className="text-xs text-graphite">{topicNames(db, a.topic_ids).join(", ")}</div></td>
                        <td className="px-3 py-2 whitespace-nowrap">{ASSESSMENT_KIND[a.kind]}</td>
                        <td className="px-3 py-2 whitespace-nowrap tabular-nums">{a.score}/{a.max_score}{sc && ` → ${convertScore(sc, a.score)}`}</td>
                        <td className="px-3 py-2"><Badge color={p >= settings.weak_threshold ? "green" : p >= 50 ? "amber" : "red"}>{Math.round(p)}%</Badge></td>
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          {a.quiz_id && <Link href={`/tests/run?attempt=${a.id}`} className="text-xs text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">ответы</Link>}
                        </td>
                      </tr>
                    );
                  })}
                </Table>
              </Card>
            ) : <Empty icon="target" title="Результатов нет" />}
          </>
        )}

        {tab === "quizzes" && (
          <>
            <div className="mb-4 flex justify-end"><Button icon="plus" onClick={() => setQuizModal({})}>Создать тест</Button></div>
            {db.quizzes.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {db.quizzes.map((q) => (
                  <Card key={q.id}>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{q.title}</div>
                        <div className="text-sm text-graphite">{q.questions.length} вопр. · {sum(q.questions.map((x) => x.points))} балл. {q.description && `· ${q.description}`}</div>
                        <div className="mt-1 text-xs text-graphite">{topicNames(db, q.topic_ids).join(", ")}</div>
                        <div className="mt-1 text-xs text-graphite">Пройден {db.assessments.filter((a) => a.quiz_id === q.id).length} раз</div>
                      </div>
                      <IconButton icon="edit" label="Редактировать" onClick={() => setQuizModal({ q })} />
                      <IconButton icon="trash" label="Удалить" onClick={async () => (await confirm({ title: "Удалить тест?", text: `«${q.title}». Уже полученные результаты сохранятся.` })) && remove("quizzes", q.id)} />
                    </div>
                    <Link href={`/tests/run?quiz=${q.id}`} className="mt-3 inline-block"><Button size="sm" icon="play">Провести</Button></Link>
                  </Card>
                ))}
              </div>
            ) : <Empty icon="target" title="Тестов пока нет" text="Создайте тест с вопросами — варианты ответа и короткие ответы проверяются автоматически." />}
          </>
        )}

        {tab === "weak" && (
          <div className="grid gap-3 md:grid-cols-2">
            {weak.map(({ s, weak: w, last }) => (
              <Card key={s.id} title={<Link href={`/students/view?id=${s.id}&tab=grades`} className="hover:underline">{s.full_name}</Link>}
                actions={<span className="text-xs text-graphite">последняя проверка: {last ? fmtDate(last) : "не было"}</span>}>
                {w.length ? (
                  <ul className="space-y-1">
                    {w.map((x) => <li key={x.topic.id} className="flex justify-between text-sm"><span>{x.topic.name}</span><Badge color={x.avg < 50 ? "red" : "amber"}>{Math.round(x.avg)}%</Badge></li>)}
                  </ul>
                ) : <p className="text-sm text-graphite">Слабых тем (ниже {settings.weak_threshold}%) нет</p>}
              </Card>
            ))}
          </div>
        )}
      </div>
      {modal && <AssessmentModal open a={modal.a} onClose={() => setModal(null)} />}
      {quizModal && <QuizEditor quiz={quizModal.q} onClose={() => setQuizModal(null)} />}
    </>
  );
}

const newQuestion = (type: QuestionType = "single"): Question => ({ id: uid(), type, text: "", options: type === "open" ? [] : ["", ""], correct: [], answer: "", points: 1, topic_id: null });

function QuizEditor({ quiz, onClose }: { quiz?: Quiz; onClose: () => void }) {
  const { db, insert, update } = useStore();
  const [q, setQ] = useState<Quiz>(quiz ? structuredClone(quiz) : { id: uid(), title: "", description: "", topic_ids: [], questions: [newQuestion()] });
  const opts = topicOptions(db);
  const setQuestion = (i: number, patch: Partial<Question>) => setQ((x) => ({ ...x, questions: x.questions.map((qq, j) => (j === i ? { ...qq, ...patch } : qq)) }));
  const valid = q.title.trim() && q.questions.length && q.questions.every((x) => x.text.trim() && (x.type === "open" || x.options.filter((o) => o.trim()).length >= 2 && x.correct.length));
  const save = async () => {
    const clean = { ...q, questions: q.questions.map((x) => ({ ...x, options: x.type === "open" ? [] : x.options })) };
    if (quiz) await update("quizzes", q.id, clean);
    else await insert("quizzes", clean);
    onClose();
  };
  return (
    <Modal open wide onClose={onClose} title={quiz ? "Редактировать тест" : "Новый тест"}
      footer={<><span className="mr-auto self-center text-xs text-graphite">{!valid && "Заполните название, тексты вопросов и отметьте правильные варианты"}</span><Button variant="secondary" onClick={onClose}>Отмена</Button><Button onClick={save} disabled={!valid}>Сохранить</Button></>}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Название"><Input value={q.title} onChange={(e) => setQ({ ...q, title: e.target.value })} /></Field>
          <Field label="Описание"><Input value={q.description} onChange={(e) => setQ({ ...q, description: e.target.value })} /></Field>
        </div>
        <Field label="Темы теста"><MultiPick options={opts} value={q.topic_ids} onChange={(v) => setQ({ ...q, topic_ids: v })} /></Field>
        {q.questions.map((x, i) => (
          <div key={x.id} className="rounded-xl border border-line p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">Вопрос {i + 1}</span>
              <Select className="w-auto py-1 text-xs" value={x.type} onChange={(e) => { const t = e.target.value as QuestionType; setQuestion(i, { type: t, correct: [], options: t === "open" ? [] : x.options.length ? x.options : ["", ""] }); }}>
                <option value="single">Один вариант</option><option value="multi">Несколько вариантов</option><option value="open">Открытый ответ</option>
              </Select>
              <Input type="number" min={1} className="w-20 py-1 text-xs" value={x.points} onChange={(e) => setQuestion(i, { points: Math.max(1, Number(e.target.value)) })} title="Баллы" />
              <span className="text-xs text-graphite">балл.</span>
              <IconButton icon="trash" label="Удалить вопрос" className="ml-auto" onClick={() => setQ({ ...q, questions: q.questions.filter((_, j) => j !== i) })} />
            </div>
            <Textarea rows={2} value={x.text} onChange={(e) => setQuestion(i, { text: e.target.value })} placeholder="Текст вопроса" />
            {x.type === "open" ? (
              <Field label="Правильный ответ (варианты через «;»)" className="mt-2" hint="Сравнение без учёта регистра, пробелов, «ё/е» и «,/.». Если оставить пустым — проверите вручную.">
                <Input value={x.answer} onChange={(e) => setQuestion(i, { answer: e.target.value })} placeholder="3; 3.0" />
              </Field>
            ) : (
              <div className="mt-2 space-y-1.5">
                {x.options.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input type={x.type === "single" ? "radio" : "checkbox"} name={`c-${x.id}`} className="h-4 w-4 accent-ink" checked={x.correct.includes(oi)} title="Правильный"
                      onChange={(e) => setQuestion(i, { correct: x.type === "single" ? [oi] : e.target.checked ? [...x.correct, oi] : x.correct.filter((c) => c !== oi) })} />
                    <Input value={o} onChange={(e) => setQuestion(i, { options: x.options.map((oo, k) => (k === oi ? e.target.value : oo)) })} placeholder={`Вариант ${oi + 1}`} />
                    <IconButton icon="x" label="Убрать вариант" onClick={() => setQuestion(i, { options: x.options.filter((_, k) => k !== oi), correct: x.correct.filter((c) => c !== oi).map((c) => (c > oi ? c - 1 : c)) })} />
                  </div>
                ))}
                <Button size="sm" variant="ghost" icon="plus" onClick={() => setQuestion(i, { options: [...x.options, ""] })}>Вариант</Button>
                <p className="text-xs text-graphite">Отметьте правильные варианты слева.</p>
              </div>
            )}
            <Field label="Тема вопроса (для анализа слабых тем)" className="mt-2">
              <Select value={x.topic_id ?? ""} onChange={(e) => setQuestion(i, { topic_id: e.target.value || null })}>
                <option value="">—</option>
                {(q.topic_ids.length ? opts.filter((o) => q.topic_ids.includes(o.id)) : opts).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </Select>
            </Field>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon="plus" onClick={() => setQ({ ...q, questions: [...q.questions, newQuestion()] })}>Вопрос с вариантами</Button>
          <Button variant="secondary" icon="plus" onClick={() => setQ({ ...q, questions: [...q.questions, newQuestion("open")] })}>Вопрос с открытым ответом</Button>
        </div>
        <p className="text-xs text-graphite"><Icon name="alert" className="mr-1 inline w-3 h-3" />Изменения теста не меняют уже сохранённые результаты.</p>
      </div>
    </Modal>
  );
}
