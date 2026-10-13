"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { DB, SettingsData, Student } from "@/lib/types";
import {
  ASSESSMENT_KIND, assessmentPercent, attendance, convertScore, homeworkStats, ledger, progress, topicNames, weakTopics,
} from "@/lib/logic";
import { addMonths, fmtDate, rub, todayYmd, ymd, MONTHS } from "@/lib/utils";
import { Button, Card, Empty, Field, Input, PageHeader, Segmented, Textarea } from "@/components/ui";
import { StudentSelect } from "@/components/forms";

function buildReport(db: DB, st: SettingsData, s: Student, from: string, to: string) {
  const att = attendance(db, s.id, from, to);
  const done = att.lessons.filter((l) => l.status === "done").sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const topics = [...new Set(done.flatMap((l) => l.topic_ids))];
  const tests = db.assessments.filter((a) => a.student_id === s.id && a.date >= from && a.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  const hw = homeworkStats(db, s.id, from, to);
  const lg = ledger(db, s.id, st);
  const pr = progress(db, s.id);
  const weak = weakTopics(db, s.id, st);
  const grades = done.filter((l) => l.grade != null).map((l) => l.grade!);
  const avgGrade = grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : null;

  const rec: string[] = [];
  if (weak.length) rec.push(`Повторить темы: ${weak.slice(0, 4).map((w) => w.topic.name).join(", ")}.`);
  if (hw.rate != null && hw.rate < 80) rec.push(`Выполнять домашние задания регулярно (сейчас ${Math.round(hw.rate)}%) — это напрямую влияет на результат.`);
  if (att.no_show + att.cancelled_student >= 2) rec.push("Стараться не пропускать занятия, чтобы сохранить темп подготовки.");
  const regular = tests.filter((a) => a.kind !== "exam");
  if (regular.length >= 2) {
    const d = assessmentPercent(regular[regular.length - 1]) - assessmentPercent(regular[0]);
    if (d > 5) rec.push("Результаты проверочных растут — продолжаем в том же темпе.");
    else if (d < -5) rec.push("Результаты проверочных снизились — добавим больше практики по пройденным темам.");
  }
  if (!rec.length) rec.push("Продолжаем работу по плану. Отличная динамика!");
  return { att, done, topics, tests, hw, lg, pr, weak, avgGrade, rec: rec.join("\n") };
}

export default function ReportsPage() {
  const { db, settings } = useStore();
  const [sid, setSid] = useState("");
  const now = new Date();
  const [preset, setPreset] = useState<"month" | "prev" | "custom">("month");
  const [from, setFrom] = useState(ymd(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(todayYmd());
  const [rec, setRec] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(location.search).get("student");
    if (p) setSid(p);
  }, []);
  useEffect(() => {
    if (preset === "month") { setFrom(ymd(new Date(now.getFullYear(), now.getMonth(), 1))); setTo(todayYmd()); }
    if (preset === "prev") { const a = addMonths(now, -1); setFrom(ymd(a)); setTo(ymd(new Date(a.getFullYear(), a.getMonth() + 1, 0))); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const s = db.students.find((x) => x.id === sid);
  const r = useMemo(() => (s ? buildReport(db, settings, s, from, to) : null), [db, settings, s, from, to]);
  useEffect(() => { if (r) setRec(r.rec); }, [r?.rec]); // eslint-disable-line react-hooks/exhaustive-deps

  const text = useMemo(() => {
    if (!s || !r) return "";
    const L: string[] = [];
    L.push(`Отчёт о занятиях: ${s.full_name}`);
    L.push(`Период: ${fmtDate(from)} – ${fmtDate(to)}`);
    L.push("");
    L.push(`📅 Посещаемость: проведено ${r.att.done} из ${r.att.done + r.att.cancelled_student + r.att.no_show} запланированных` +
      (r.att.cancelled_student ? `, отменено учеником ${r.att.cancelled_student}` : "") + (r.att.no_show ? `, пропусков ${r.att.no_show}` : "") +
      (r.att.cancelled_tutor ? `, перенесено мной ${r.att.cancelled_tutor}` : "") + ".");
    if (r.avgGrade != null) L.push(`Средняя оценка работы на занятиях: ${r.avgGrade.toFixed(1)} из 5.`);
    L.push("");
    L.push("📚 Пройденные темы:");
    L.push(r.topics.length ? topicNames(db, r.topics).map((t) => `• ${t}`).join("\n") : "• —");
    if (r.pr.total) L.push(`Пройдено ${Math.round(r.pr.percent)}% программы.`);
    L.push("");
    L.push("📝 Результаты проверок:");
    if (r.tests.length)
      r.tests.forEach((a) => {
        const sc = settings.exam_scales.find((x) => x.key === a.exam_scale);
        const conv = convertScore(sc, a.score);
        L.push(`• ${fmtDate(a.date)} ${a.title}: ${a.score}/${a.max_score} (${Math.round(assessmentPercent(a))}%)${conv != null ? ` → ${conv}${sc?.name.includes("оценка") ? " (оценка)" : " баллов"}` : ""}`);
      });
    else L.push("• в этом периоде не проводились");
    L.push("");
    L.push(`🏠 Домашние задания: ${r.hw.rate == null ? "не задавались" : `выполнено ${r.hw.done} из ${r.hw.done + r.hw.failed} (${Math.round(r.hw.rate)}%)`}${r.hw.avgGrade != null ? `, средняя оценка ${r.hw.avgGrade.toFixed(1)}` : ""}.`);
    L.push("");
    L.push("💡 Рекомендации:");
    L.push(rec.split("\n").filter(Boolean).map((x) => `• ${x}`).join("\n"));
    L.push("");
    L.push(`💳 Баланс: ${r.lg.balance < 0 ? `задолженность ${rub(-r.lg.balance)}` : r.lg.balance > 0 ? `предоплата ${rub(r.lg.balance)}` : "расчёт закрыт"}` +
      (r.lg.activeSub ? `; в абонементе осталось занятий: ${r.lg.activeSub.left}` : "") + ".");
    if (settings.tutor_name) { L.push(""); L.push(`С уважением, ${settings.tutor_name}`); }
    return L.join("\n");
  }, [s, r, rec, from, to, db, settings]);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <PageHeader title="Отчёты для родителей" subtitle="Готовый текст для мессенджера и версия для печати / PDF" />
      <div className="no-print mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Ученик"><StudentSelect value={sid} onChange={setSid} includeInactive /></Field>
        <Field label="Период">
          <Segmented value={preset} onChange={setPreset} options={[{ id: "month", label: MONTHS[now.getMonth()] }, { id: "prev", label: "Прошлый" }, { id: "custom", label: "Свой" }]} />
        </Field>
        <Field label="С"><Input type="date" value={from} onChange={(e) => { setPreset("custom"); setFrom(e.target.value); }} /></Field>
        <Field label="По"><Input type="date" value={to} onChange={(e) => { setPreset("custom"); setTo(e.target.value); }} /></Field>
      </div>
      {!s || !r ? <Empty icon="file" title="Выберите ученика" text="Отчёт сформируется автоматически за выбранный период." /> : (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="no-print space-y-4">
            <Card title="Рекомендации (можно отредактировать)">
              <Textarea rows={5} value={rec} onChange={(e) => setRec(e.target.value)} />
            </Card>
            <Card title="Текст для мессенджера" actions={<Button size="sm" icon={copied ? "check" : "copy"} onClick={copy}>{copied ? "Скопировано" : "Скопировать"}</Button>}>
              <pre className="max-h-[420px] overflow-y-auto whitespace-pre-wrap font-sans text-sm">{text}</pre>
            </Card>
            <Button variant="secondary" icon="print" onClick={() => window.print()}>Печать / сохранить PDF</Button>
          </div>

          {/* печатная версия */}
          <div className="print-area rounded-xl border border-line bg-surface p-6 text-ink ">
            <div className="border-b border-line pb-3">
              <div className="text-xs text-graphite">Отчёт о занятиях</div>
              <h2 className="text-xl font-semibold">{s.full_name}</h2>
              <div className="text-sm text-graphite">{[s.grade && `${s.grade} класс`, s.goal && `цель: ${s.goal}`].filter(Boolean).join(" · ")}</div>
              <div className="text-sm text-graphite">Период: {fmtDate(from)} – {fmtDate(to)}</div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-mist p-2"><div className="text-2xl font-semibold">{r.att.done}</div><div className="text-xs text-graphite">занятий проведено</div></div>
              <div className="rounded-lg bg-mist p-2"><div className="text-2xl font-semibold">{r.hw.rate == null ? "—" : `${Math.round(r.hw.rate)}%`}</div><div className="text-xs text-graphite">ДЗ выполнено</div></div>
              <div className="rounded-lg bg-mist p-2"><div className="text-2xl font-semibold">{r.pr.total ? `${Math.round(r.pr.percent)}%` : "—"}</div><div className="text-xs text-graphite">программы пройдено</div></div>
            </div>
            <h3 className="mt-5 font-semibold">Посещаемость</h3>
            <p className="text-sm">Проведено: {r.att.done}; отменено учеником: {r.att.cancelled_student}; пропуски без предупреждения: {r.att.no_show}; перенесено преподавателем: {r.att.cancelled_tutor}.{r.avgGrade != null && ` Средняя оценка работы на занятиях: ${r.avgGrade.toFixed(1)}.`}</p>
            <h3 className="mt-4 font-semibold">Пройденные темы</h3>
            {r.topics.length ? <ul className="list-disc pl-5 text-sm">{topicNames(db, r.topics).map((t) => <li key={t}>{t}</li>)}</ul> : <p className="text-sm">—</p>}
            <h3 className="mt-4 font-semibold">Результаты проверок</h3>
            {r.tests.length ? (
              <table className="mt-1 w-full text-sm">
                <thead><tr className="border-b text-left text-xs text-graphite"><th className="py-1">Дата</th><th>Работа</th><th>Баллы</th><th>%</th></tr></thead>
                <tbody>
                  {r.tests.map((a) => {
                    const sc = settings.exam_scales.find((x) => x.key === a.exam_scale);
                    const conv = convertScore(sc, a.score);
                    return <tr key={a.id} className="border-b border-line"><td className="py-1">{fmtDate(a.date)}</td><td>{a.title} <span className="text-xs text-graphite">({ASSESSMENT_KIND[a.kind]})</span></td><td>{a.score}/{a.max_score}{conv != null && ` → ${conv}`}</td><td>{Math.round(assessmentPercent(a))}%</td></tr>;
                  })}
                </tbody>
              </table>
            ) : <p className="text-sm">В этом периоде не проводились.</p>}
            <h3 className="mt-4 font-semibold">Домашние задания</h3>
            <p className="text-sm">{r.hw.rate == null ? "Не задавались." : `Выполнено ${r.hw.done} из ${r.hw.done + r.hw.failed} (${Math.round(r.hw.rate)}%).`}{r.hw.avgGrade != null && ` Средняя оценка: ${r.hw.avgGrade.toFixed(1)}.`}</p>
            <h3 className="mt-4 font-semibold">Рекомендации</h3>
            <ul className="list-disc pl-5 text-sm">{rec.split("\n").filter(Boolean).map((x, i) => <li key={i}>{x}</li>)}</ul>
            <h3 className="mt-4 font-semibold">Баланс</h3>
            <p className="text-sm">{r.lg.balance < 0 ? `Задолженность: ${rub(-r.lg.balance)}` : r.lg.balance > 0 ? `Предоплата: ${rub(r.lg.balance)}` : "Расчёт закрыт"}{r.lg.activeSub && `. В абонементе осталось занятий: ${r.lg.activeSub.left} (до ${fmtDate(r.lg.activeSub.sub.expires_at)})`}.</p>
            {settings.tutor_name && <p className="mt-6 text-sm text-graphite">Преподаватель: {settings.tutor_name}</p>}
          </div>
        </div>
      )}
    </>
  );
}
