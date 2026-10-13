"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { STUDENT_STATUS, allLedgers, progress } from "@/lib/logic";
import { fmtDate, rub } from "@/lib/utils";
import { Avatar, Badge, Button, Empty, PageHeader, Progress, SearchInput, Select } from "@/components/ui";
import { StudentModal } from "@/components/forms";

export default function StudentsPage() {
  const { db, settings } = useStore();
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState("");
  const [status, setStatus] = useState("active");
  const [debt, setDebt] = useState("");
  const [adding, setAdding] = useState(false);
  const ledgers = useMemo(() => allLedgers(db, settings), [db, settings]);
  const grades = [...new Set(db.students.map((s) => s.grade).filter(Boolean))].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  const now = new Date().toISOString();

  const list = db.students
    .filter((s) => !q || [s.full_name, s.goal, s.parent_name, s.phone].join(" ").toLowerCase().includes(q.toLowerCase()))
    .filter((s) => !grade || s.grade === grade)
    .filter((s) => !status || s.status === status)
    .filter((s) => {
      const b = ledgers.get(s.id)?.balance ?? 0;
      return !debt || (debt === "debt" ? b < 0 : b >= 0);
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <>
      <PageHeader title="Ученики" subtitle={`${db.students.filter((s) => s.status === "active").length} активных из ${db.students.length}`}
        actions={<Button icon="plus" onClick={() => setAdding(true)}>Добавить ученика</Button>} />
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <div className="sm:col-span-1"><SearchInput value={q} onChange={setQ} placeholder="Имя, цель, телефон…" /></div>
        <Select value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">Все классы</option>{grades.map((g) => <option key={g} value={g}>{g} класс</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Все статусы</option>{Object.entries(STUDENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <Select value={debt} onChange={(e) => setDebt(e.target.value)}>
          <option value="">Любой баланс</option><option value="debt">Есть долг</option><option value="ok">Без долга</option>
        </Select>
      </div>

      {list.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((s) => {
            const lg = ledgers.get(s.id)!;
            const pr = progress(db, s.id);
            const next = db.lessons.filter((l) => l.student_id === s.id && l.status === "planned" && l.starts_at > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
            return (
              <Link key={s.id} href={`/students/view?id=${s.id}`} className="block rounded-xl border border-line bg-surface p-4 transition-shadow hover:">
                <div className="flex items-start gap-3">
                  <Avatar name={s.full_name} color={s.color} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{s.full_name}</span>
                      {s.status !== "active" && <Badge color={STUDENT_STATUS[s.status].color}>{STUDENT_STATUS[s.status].label}</Badge>}
                    </div>
                    <div className="text-sm text-graphite">{[s.grade && `${s.grade} класс`, s.goal, s.format === "online" ? "онлайн" : "очно"].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-semibold tabular-nums ${lg.balance < 0 ? "text-signal" : ""}`}>{rub(lg.balance)}</div>
                    {lg.activeSub && <div className="text-xs text-graphite">абон.: {lg.activeSub.left} из {lg.activeSub.sub.lessons_total}</div>}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Progress value={pr.percent} className="flex-1" />
                  <span className="w-28 text-right text-xs text-graphite">программа {Math.round(pr.percent)}%</span>
                </div>
                <div className="mt-2 text-xs text-graphite">
                  {next ? `Следующее: ${fmtDate(next.starts_at)} в ${new Date(next.starts_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : "Нет запланированных занятий"}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty icon="users" title="Ученики не найдены" text="Измените фильтры или добавьте нового ученика." action={<Button icon="plus" onClick={() => setAdding(true)}>Добавить ученика</Button>} />
      )}
      {adding && <StudentModal open onClose={() => setAdding(false)} />}
    </>
  );
}
