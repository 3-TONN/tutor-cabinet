"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { STUDENT_STATUS, homeworkStats, ledger, progress, studentDuration, studentPrice } from "@/lib/logic";
import { fmtDate, rub } from "@/lib/utils";
import { Avatar, Badge, Button, Empty, Tabs, useConfirm } from "@/components/ui";
import { StudentModal, contactLinks } from "@/components/forms";
import { GradesTab, HomeworkTab, LessonsTab, NotesTab, PaymentsTab, TopicsTab } from "@/components/student-tabs";
import { Icon } from "@/components/Icon";

type Tab = "lessons" | "topics" | "grades" | "homework" | "payments" | "notes";

// Статический экспорт (GitHub Pages): id ученика передаётся в адресе ?id=…
export default function StudentPageRoute() {
  return (
    <Suspense fallback={null}>
      <StudentPage />
    </Suspense>
  );
}

function StudentPage() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const router = useRouter();
  const { db, settings, removeStudent, backend, setPortalStudentId } = useStore();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("lessons");
  const [edit, setEdit] = useState(false);
  useEffect(() => {
    const t = params.get("tab") as Tab | null;
    setTab(t ?? "lessons");
  }, [params]);
  const s = db.students.find((x) => x.id === id);
  const lg = useMemo(() => (s ? ledger(db, s.id, settings) : null), [db, s, settings]);
  if (!s || !lg) return <Empty icon="users" title="Ученик не найден" action={<Link href="/students"><Button>К списку учеников</Button></Link>} />;

  const pr = progress(db, s.id);
  const hw = homeworkStats(db, s.id);
  const del = async () => {
    if (await confirm({ title: "Удалить ученика?", text: `${s.full_name} и ВСЕ связанные данные (занятия, оплаты, оценки, ДЗ, заметки) будут удалены без возможности восстановления. Если ученик просто закончил заниматься — лучше поставьте статус «Завершил».`, ok: "Удалить навсегда" })) {
      await removeStudent(s.id);
      router.push("/students");
    }
  };
  const viewAsStudent = () => {
    setPortalStudentId(s.id);
    router.push("/portal");
  };

  return (
    <>
      <Link href="/students" className="mb-3 inline-flex items-center gap-1 text-sm text-graphite hover:text-ink no-print"><Icon name="left" className="w-4 h-4" />Ученики</Link>
      <div className="mb-5 rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={s.full_name} color={s.color} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{s.full_name}</h1>
              <Badge color={STUDENT_STATUS[s.status].color}>{STUDENT_STATUS[s.status].label}</Badge>
            </div>
            <div className="mt-0.5 text-sm text-graphite">
              {[s.grade && `${s.grade} класс`, s.goal && `Цель: ${s.goal}`, s.format === "online" ? "онлайн" : "очно", `${rub(studentPrice(s, settings))} / ${studentDuration(s, settings)} мин`, `с ${fmtDate(s.start_date)}`].filter(Boolean).join(" · ")}
            </div>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs text-graphite">Ученик</div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {contactLinks(s.phone, s.telegram, s.whatsapp).map((c) => <a key={c.href} href={c.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink"><Icon name={c.icon} className="w-3.5 h-3.5" />{c.label}</a>)}
                  {!s.phone && !s.telegram && !s.whatsapp && <span className="text-graphite">нет контактов</span>}
                </div>
              </div>
              <div>
                <div className="text-xs text-graphite">Родитель{s.parent_name ? `: ${s.parent_name}` : ""}</div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {contactLinks(s.parent_phone, s.parent_telegram, s.parent_whatsapp).map((c) => <a key={c.href} href={c.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink"><Icon name={c.icon} className="w-3.5 h-3.5" />{c.label}</a>)}
                  {!s.parent_phone && !s.parent_telegram && !s.parent_whatsapp && <span className="text-graphite">нет контактов</span>}
                </div>
              </div>
            </div>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button variant="secondary" icon="edit" onClick={() => setEdit(true)}>Изменить</Button>
            <Link href={`/reports?student=${s.id}`}><Button variant="secondary" icon="file">Отчёт</Button></Link>
            {backend?.mode === "local" && <Button variant="secondary" icon="eye" onClick={viewAsStudent}>Глазами ученика</Button>}
            <Button variant="ghost" icon="trash" className="text-signal" onClick={del}>Удалить</Button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
          <div><div className="text-xs text-graphite">Баланс</div><div className={`font-semibold ${lg.balance < 0 ? "text-signal" : ""}`}>{rub(lg.balance)}</div></div>
          <div><div className="text-xs text-graphite">Абонемент</div><div className="font-semibold">{lg.activeSub ? `${lg.activeSub.left} из ${lg.activeSub.sub.lessons_total}` : "—"}</div></div>
          <div><div className="text-xs text-graphite">Программа</div><div className="font-semibold">{pr.total ? `${Math.round(pr.percent)}%` : "—"}</div></div>
          <div><div className="text-xs text-graphite">ДЗ выполнено</div><div className="font-semibold">{hw.rate == null ? "—" : `${Math.round(hw.rate)}%`}</div></div>
        </div>
      </div>

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: "lessons", label: "Занятия" }, { id: "topics", label: "Темы" }, { id: "grades", label: "Оценки" },
        { id: "homework", label: "Домашние задания" }, { id: "payments", label: "Оплаты" }, { id: "notes", label: "Заметки" },
      ]} />
      <div className="mt-4">
        {tab === "lessons" && <LessonsTab studentId={s.id} />}
        {tab === "topics" && <TopicsTab studentId={s.id} />}
        {tab === "grades" && <GradesTab studentId={s.id} />}
        {tab === "homework" && <HomeworkTab studentId={s.id} />}
        {tab === "payments" && <PaymentsTab studentId={s.id} />}
        {tab === "notes" && <NotesTab studentId={s.id} />}
      </div>
      {edit && <StudentModal open student={s} onClose={() => setEdit(false)} />}
    </>
  );
}
