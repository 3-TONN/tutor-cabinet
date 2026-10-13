"use client";

import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Homework, HomeworkStatus } from "@/lib/types";
import { HW_STATUS, homeworkStats, hwEffective, topicNames } from "@/lib/logic";
import { fmtDate } from "@/lib/utils";
import { Badge, Button, Card, Empty, PageHeader, Progress, Select, Tabs } from "@/components/ui";
import { HomeworkModal, StudentSelect } from "@/components/forms";

type Tab = "list" | "stats";

export default function HomeworkPage() {
  const { db, update } = useStore();
  const [tab, setTab] = useState<Tab>("list");
  const [sid, setSid] = useState("");
  const [status, setStatus] = useState<HomeworkStatus | "overdue" | "open" | "">("open");
  const [modal, setModal] = useState<{ h?: Homework } | null>(null);
  const name = (id: string) => db.students.find((s) => s.id === id)?.full_name ?? "—";
  const list = db.homework
    .filter((h) => !sid || h.student_id === sid)
    .filter((h) => {
      const e = hwEffective(h);
      if (!status) return true;
      if (status === "open") return e === "assigned" || e === "overdue" || e === "submitted";
      return e === status;
    })
    .sort((a, b) => (status === "open" ? a.due_date.localeCompare(b.due_date) : b.due_date.localeCompare(a.due_date)));

  return (
    <>
      <PageHeader title="Домашние задания" actions={<Button icon="plus" onClick={() => setModal({})}>Задание</Button>} />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: "list", label: "Задания" }, { id: "stats", label: "Статистика" }]} />
      <div className="mt-4">
        {tab === "list" ? (
          <>
            <div className="mb-4 grid gap-2 sm:grid-cols-3">
              <StudentSelect value={sid} onChange={setSid} allowEmpty="Все ученики" />
              <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                <option value="open">Требуют действий</option>
                <option value="">Все</option>
                {(["assigned", "overdue", "submitted", "checked", "missed"] as const).map((s) => <option key={s} value={s}>{HW_STATUS[s].label}</option>)}
              </Select>
            </div>
            {list.length ? (
              <div className="space-y-2">
                {list.map((h) => {
                  const e = hwEffective(h);
                  return (
                    <div key={h.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-3">
                      <button type="button" onClick={() => setModal({ h })} className="min-w-0 flex-1 text-left">
                        <div className="font-medium">{h.title}</div>
                        <div className="text-xs text-graphite">{name(h.student_id)} · срок {fmtDate(h.due_date)}{h.topic_ids.length ? ` · ${topicNames(db, h.topic_ids).join(", ")}` : ""}{h.attachments.length ? ` · 📎 ${h.attachments.length}` : ""}</div>
                      </button>
                      <Badge color={HW_STATUS[e].color}>{HW_STATUS[e].label}</Badge>
                      {h.grade != null && <Badge color="violet">{h.grade}</Badge>}
                      <div className="flex gap-1">
                        {(e === "assigned" || e === "overdue") && <Button size="sm" variant="secondary" onClick={() => update("homework", h.id, { status: "submitted" })}>Сдано</Button>}
                        {(e === "assigned" || e === "overdue" || e === "submitted") && <Button size="sm" onClick={() => setModal({ h: { ...h, status: "checked" } })}>Проверить</Button>}
                        {e === "overdue" && <Button size="sm" variant="ghost" onClick={() => update("homework", h.id, { status: "missed" })}>Не сдано</Button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <Empty icon="clipboard" title="Заданий нет" text={status === "open" ? "Все задания проверены." : undefined} />}
          </>
        ) : (
          <Card padded={false}>
            <div className="divide-y divide-line">
              {db.students.filter((s) => s.status !== "finished").map((s) => {
                const st = homeworkStats(db, s.id);
                return (
                  <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <Link href={`/students/view?id=${s.id}&tab=homework`} className="w-56 font-medium hover:underline">{s.full_name}</Link>
                    <div className="flex min-w-[160px] flex-1 items-center gap-2">
                      <Progress value={st.rate ?? 0} className="flex-1" />
                      <span className="w-12 text-right text-sm font-semibold">{st.rate == null ? "—" : `${Math.round(st.rate)}%`}</span>
                    </div>
                    <div className="text-xs text-graphite">выполнено {st.done} · не сдано {st.failed} · в работе {st.pending}{st.avgGrade != null ? ` · ср. оценка ${st.avgGrade.toFixed(1)}` : ""}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
      {modal && <HomeworkModal open hw={modal.h} studentId={sid || undefined} onClose={() => setModal(null)} />}
    </>
  );
}
