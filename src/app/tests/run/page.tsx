"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Assessment, Question, Quiz } from "@/lib/types";
import { normalizeAnswer, sum, todayYmd, uid, fmtDate } from "@/lib/utils";
import { Badge, Button, Card, Empty, Field, Input, PageHeader, Select } from "@/components/ui";
import { StudentSelect } from "@/components/forms";
import { Icon } from "@/components/Icon";

type Answers = Record<string, string | string[]>;

/** Автопроверка: варианты — точное совпадение набора, открытый ответ — сравнение с ключом */
function autoPoints(q: Question, a: string | string[] | undefined): number | null {
  if (q.type === "open") {
    if (!q.answer.trim()) return null; // нужна ручная проверка
    const given = normalizeAnswer(String(a ?? ""));
    return given && q.answer.split(";").some((v) => normalizeAnswer(v) === given) ? q.points : 0;
  }
  const sel = (Array.isArray(a) ? a : a != null && a !== "" ? [a] : []).map(Number).sort();
  const cor = [...q.correct].sort();
  return sel.length === cor.length && sel.every((v, i) => v === cor[i]) ? q.points : 0;
}

function topicResults(quiz: Quiz, points: Record<string, number>) {
  const by = new Map<string, { got: number; max: number }>();
  quiz.questions.forEach((q) => {
    if (!q.topic_id) return;
    const e = by.get(q.topic_id) ?? { got: 0, max: 0 };
    e.got += points[q.id] ?? 0;
    e.max += q.points;
    by.set(q.topic_id, e);
  });
  return Object.fromEntries([...by.entries()].map(([k, v]) => [k, Math.round((v.got / v.max) * 100)]));
}

export default function RunQuizPage() {
  const { db, insert, update, toast } = useStore();
  const [quizId, setQuizId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [points, setPoints] = useState<Record<string, number> | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const att = p.get("attempt");
    if (att) {
      const a = db.assessments.find((x) => x.id === att);
      if (a?.quiz_id) {
        setAttemptId(att); setQuizId(a.quiz_id); setStudentId(a.student_id); setAnswers(a.answers ?? {}); setPoints(a.question_points ?? {}); setStarted(true); setSaved(true);
      }
      return;
    }
    if (p.get("quiz")) setQuizId(p.get("quiz")!);
    if (p.get("student")) setStudentId(p.get("student")!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quiz = db.quizzes.find((q) => q.id === quizId);
  const student = db.students.find((s) => s.id === studentId);

  if (!db.quizzes.length)
    return <Empty icon="target" title="Нет тестов" text="Сначала создайте тест в разделе «Контроль знаний»." action={<Link href="/tests"><Button>Перейти</Button></Link>} />;

  if (!started || !quiz)
    return (
      <>
        <PageHeader title="Провести тест" />
        <Card className="max-w-lg">
          <div className="space-y-3">
            <Field label="Тест">
              <Select value={quizId} onChange={(e) => setQuizId(e.target.value)}>
                <option value="">Выберите тест</option>
                {db.quizzes.map((q) => <option key={q.id} value={q.id}>{q.title} ({q.questions.length} вопр.)</option>)}
              </Select>
            </Field>
            <Field label="Ученик"><StudentSelect value={studentId} onChange={setStudentId} /></Field>
            <Button icon="play" disabled={!quiz || !studentId} onClick={() => { setStarted(true); setAnswers({}); setPoints(null); setSaved(false); }}>Начать</Button>
            <p className="text-xs text-graphite">Передайте устройство ученику или проведите тест вместе на онлайн-занятии (демонстрация экрана).</p>
          </div>
        </Card>
      </>
    );

  const maxScore = sum(quiz.questions.map((q) => q.points));
  const check = () => {
    const p: Record<string, number> = {};
    quiz.questions.forEach((q) => (p[q.id] = autoPoints(q, answers[q.id]) ?? 0));
    setPoints(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const needsManual = (q: Question) => q.type === "open" && !q.answer.trim();
  const score = points ? sum(Object.values(points)) : 0;

  const save = async () => {
    if (!points) return;
    const row: Assessment = {
      id: attemptId ?? uid(), student_id: studentId, date: todayYmd(), title: quiz.title, kind: "quiz", topic_ids: quiz.topic_ids,
      max_score: maxScore, score, comment: "", exam_scale: null, quiz_id: quiz.id, answers, question_points: points, topic_results: topicResults(quiz, points),
    };
    if (attemptId) {
      const { id: _id, date: _d, ...patch } = row;
      await update("assessments", attemptId, patch);
    } else {
      await insert("assessments", row);
      setAttemptId(row.id);
    }
    setSaved(true);
    toast("Результат сохранён");
  };

  const setAnswer = (q: Question, v: string | string[]) => !points && setAnswers((a) => ({ ...a, [q.id]: v }));
  const attempt = attemptId ? db.assessments.find((a) => a.id === attemptId) : null;

  return (
    <>
      <PageHeader title={quiz.title} subtitle={`${student?.full_name ?? ""}${attempt ? ` · ${fmtDate(attempt.date)}` : ""} · ${quiz.questions.length} вопр. · максимум ${maxScore} балл.`}
        actions={points ? <Badge color={score / maxScore >= 0.7 ? "green" : score / maxScore >= 0.5 ? "amber" : "red"} className="px-3 py-1 text-base">{score} / {maxScore} · {Math.round((score / maxScore) * 100)}%</Badge> : null} />
      <div className="max-w-3xl space-y-3">
        {quiz.questions.map((q, i) => {
          const pts = points?.[q.id];
          const ok = pts != null && pts === q.points;
          const a = answers[q.id];
          return (
            <Card key={q.id} className={points ? (ok ? "border-ink/40" : "border-signal") : ""}>
              <div className="mb-2 flex items-start gap-2">
                <span className="text-sm font-semibold text-graphite">{i + 1}.</span>
                <p className="flex-1 whitespace-pre-line font-medium">{q.text}</p>
                <span className="text-xs text-graphite">{q.points} б.</span>
              </div>
              {q.type === "open" ? (
                <Input value={String(a ?? "")} onChange={(e) => setAnswer(q, e.target.value)} disabled={!!points} placeholder="Ответ" />
              ) : (
                <div className="space-y-1.5">
                  {q.options.map((o, oi) => {
                    const sel = q.type === "single" ? String(a ?? "") === String(oi) : Array.isArray(a) && a.includes(String(oi));
                    const correct = q.correct.includes(oi);
                    return (
                      <label key={oi} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${points && correct ? "border-ink/40 bg-mist" : points && sel ? "border-signal bg-signal/10" : sel ? "border-ink bg-mist" : "border-line"}`}>
                        <input type={q.type === "single" ? "radio" : "checkbox"} name={q.id} className="accent-ink" checked={sel} disabled={!!points}
                          onChange={(e) => q.type === "single" ? setAnswer(q, String(oi)) : setAnswer(q, e.target.checked ? [...(Array.isArray(a) ? a : []), String(oi)] : (Array.isArray(a) ? a : []).filter((x) => x !== String(oi)))} />
                        {o}
                      </label>
                    );
                  })}
                </div>
              )}
              {points && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  {ok ? <span className="text-ink"><Icon name="check" className="mr-1 inline w-4 h-4" />Верно</span> : <span className="text-signal"><Icon name="x" className="mr-1 inline w-4 h-4" />{needsManual(q) ? "Нужна проверка" : "Неверно"}</span>}
                  {q.type === "open" && q.answer && <span className="text-graphite">Ответ: {q.answer}</span>}
                  {q.type === "open" && (
                    <span className="ml-auto flex items-center gap-1 text-xs text-graphite">
                      Баллы:
                      <Input type="number" min={0} max={q.points} className="w-16 py-1" value={pts ?? 0}
                        onChange={(e) => { setPoints({ ...points, [q.id]: Math.max(0, Math.min(q.points, Number(e.target.value))) }); setSaved(false); }} />
                    </span>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        <div className="flex flex-wrap gap-2">
          {!points ? (
            <Button icon="check" onClick={check}>Завершить и проверить</Button>
          ) : (
            <>
              <Button icon="check" onClick={save} disabled={saved}>{saved ? "Сохранено" : attemptId ? "Сохранить исправления" : "Сохранить результат"}</Button>
              {saved && <Link href={`/students/view?id=${studentId}&tab=grades`}><Button variant="secondary">К оценкам ученика</Button></Link>}
              {!attemptId && <Button variant="ghost" onClick={() => { setPoints(null); setSaved(false); }}>Вернуться к ответам</Button>}
            </>
          )}
          <Link href="/tests"><Button variant="ghost">Выйти</Button></Link>
        </div>
      </div>
    </>
  );
}
