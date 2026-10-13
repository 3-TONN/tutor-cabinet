"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { Lesson } from "@/lib/types";
import { LESSON_STATUS, topicNames } from "@/lib/logic";
import { cls, fmtTime, shortName } from "@/lib/utils";
import { Badge, Button } from "./ui";

/**
 * Плашка занятия в календаре: статус читается по форме, а не по цвету ученика.
 * проведено — заливка, запланировано — контур, ждёт отметки — пунктир, отменено — зачёркнуто.
 */
export function chipClass(l: Lesson) {
  const past = new Date(l.starts_at).getTime() + l.duration * 60000 < Date.now();
  if (l.status === "done") return "bg-ink text-paper";
  if (l.status === "no_show") return "bg-signal/10 text-signal ring-1 ring-inset ring-signal/40";
  if (l.status.startsWith("cancelled")) return "bg-mist text-graphite line-through";
  if (past) return "bg-surface text-ink border border-dashed border-ink";
  return "bg-surface text-ink ring-1 ring-inset ring-ink/40";
}

export function LessonItem({ lesson, onOpen, onReport, showDate }: {
  lesson: Lesson; onOpen: (l: Lesson) => void; onReport?: (l: Lesson) => void; showDate?: boolean; compact?: boolean;
}) {
  const { db } = useStore();
  const s = db.students.find((x) => x.id === lesson.student_id);
  const st = LESSON_STATUS[lesson.status];
  const end = new Date(new Date(lesson.starts_at).getTime() + lesson.duration * 60000);
  const needsReport = lesson.status === "planned" && end.getTime() < Date.now();
  const topics = topicNames(db, lesson.topic_ids);
  const cancelled = lesson.status.startsWith("cancelled");
  return (
    <div className={cls("flex items-center gap-4 border-b border-line py-3 last:border-b-0", cancelled && "text-graphite")}>
      <button type="button" onClick={() => onOpen(lesson)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
        <div className="w-16 shrink-0">
          <div className={cls("num text-lg font-medium leading-none", cancelled && "line-through")}>{fmtTime(lesson.starts_at)}</div>
          <div className="num mt-1 text-xs text-graphite">{showDate ? new Date(lesson.starts_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }) : fmtTime(end)}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{s ? s.full_name : "—"}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-graphite">
            {lesson.status !== "planned" && <Badge color={st.color}>{st.label}</Badge>}
            {needsReport && <Badge color="amber">Ждёт отметки</Badge>}
            {topics.length > 0 && <span className="truncate">{topics.join(", ")}</span>}
          </div>
        </div>
      </button>
      {onReport && lesson.status === "planned" && (
        <Button size="sm" variant={needsReport ? "primary" : "secondary"} icon="check" onClick={() => onReport(lesson)} aria-label="Провести занятие">
          <span className="hidden sm:inline">Провести</span>
        </Button>
      )}
      {s && <Link href={`/students/view?id=${s.id}`} className="hidden text-sm text-graphite hover:text-ink lg:block">{shortName(s.full_name)}</Link>}
    </div>
  );
}
