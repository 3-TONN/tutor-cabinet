"use client";

import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Course, Topic } from "@/lib/types";
import { TOPIC_STATUS, progress, topicScores, topicStatus } from "@/lib/logic";
import { uid } from "@/lib/utils";
import { EGE_INF_COURSE, planBlocks } from "@/lib/ege-informatics";
import { Badge, Button, Card, Empty, Field, IconButton, Input, Modal, PageHeader, Progress, Segmented, Select, Textarea, useConfirm } from "@/components/ui";

export default function TopicsPage() {
  const { db, insert, update, remove } = useStore();
  const confirm = useConfirm();
  const [courseId, setCourseId] = useState(db.courses[0]?.id ?? "");
  const [view, setView] = useState<"program" | "matrix">("program");
  const [courseModal, setCourseModal] = useState<{ c?: Course } | null>(null);
  const [newTopic, setNewTopic] = useState({ section: "", name: "" });
  const [editTopic, setEditTopic] = useState<Topic | null>(null);
  const course = db.courses.find((c) => c.id === courseId) ?? db.courses[0];
  const topics = course ? db.topics.filter((t) => t.course_id === course.id).sort((a, b) => a.position - b.position) : [];
  const sections = [...new Set(topics.map((t) => t.section))];
  const students = course ? db.students.filter((s) => s.status !== "finished" && db.student_courses.some((sc) => sc.student_id === s.id && sc.course_id === course.id)) : [];

  const addTopic = async () => {
    if (!course || !newTopic.name.trim()) return;
    const section = newTopic.section.trim() || "Без раздела";
    const inSection = topics.filter((t) => t.section === section);
    const pos = Math.max(-1, ...(inSection.length ? inSection : topics).map((t) => t.position)) + 1;
    // сдвигаем следующие темы, чтобы новая встала в конец своего раздела
    for (const t of topics.filter((t) => t.position >= pos)) await update("topics", t.id, { position: t.position + 1 });
    await insert("topics", { id: uid(), course_id: course.id, section, name: newTopic.name.trim(), position: pos });
    setNewTopic({ ...newTopic, name: "" });
  };
  const move = async (t: Topic, dir: -1 | 1) => {
    const same = topics.filter((x) => x.section === t.section);
    const i = same.findIndex((x) => x.id === t.id);
    const other = same[i + dir];
    if (!other) return;
    await update("topics", t.id, { position: other.position });
    await update("topics", other.id, { position: t.position });
  };
  const delTopic = async (t: Topic) => {
    if (await confirm({ title: "Удалить тему?", text: `«${t.name}» будет удалена из программы вместе со статусами учеников по ней.` })) {
      await remove("student_topics", db.student_topics.filter((x) => x.topic_id === t.id).map((x) => x.id));
      await remove("topics", t.id);
    }
  };
  const delCourse = async (c: Course) => {
    if (await confirm({ title: "Удалить программу?", text: `«${c.name}», все её темы и статусы учеников по ним будут удалены.` })) {
      const tids = new Set(db.topics.filter((t) => t.course_id === c.id).map((t) => t.id));
      await remove("student_topics", db.student_topics.filter((x) => tids.has(x.topic_id)).map((x) => x.id));
      await remove("topics", [...tids]);
      await remove("student_courses", db.student_courses.filter((x) => x.course_id === c.id).map((x) => x.id));
      await remove("courses", c.id);
      setCourseId("");
    }
  };
  /** Готовый шаблон годового курса ЕГЭ по информатике */
  const addEgeTemplate = async () => {
    let subject = db.subjects.find((x) => x.name.toLowerCase() === "информатика");
    if (!subject) {
      subject = { id: uid(), name: "Информатика" };
      await insert("subjects", subject);
    }
    const c: Course = { id: uid(), subject_id: subject.id, ...EGE_INF_COURSE };
    await insert("courses", c);
    let pos = 0;
    await insert("topics", planBlocks().flatMap((b) => b.topics.map((name) => ({ id: uid(), course_id: c.id, section: b.section, name, position: pos++ }))));
    setCourseId(c.id);
  };
  const copyCourse = async (c: Course) => {
    const nc = { ...c, id: uid(), name: `${c.name} (копия)` };
    await insert("courses", nc);
    await insert("topics", db.topics.filter((t) => t.course_id === c.id).map((t) => ({ ...t, id: uid(), course_id: nc.id })));
    setCourseId(nc.id);
  };

  return (
    <>
      <PageHeader title="Программа и темы" subtitle="Шаблоны программ, разделы, темы и прогресс учеников"
        actions={<>
          <Button variant="secondary" icon="book" onClick={addEgeTemplate}>Шаблон «ЕГЭ информатика»</Button>
          <Button icon="plus" onClick={() => setCourseModal({})}>Программа</Button>
        </>} />
      {!db.courses.length ? (
        <Empty icon="book" title="Программ пока нет" text="Создайте шаблон программы (например, «ЕГЭ информатика») и добавьте в него разделы и темы." action={<div className="flex flex-wrap justify-center gap-2"><Button icon="book" onClick={addEgeTemplate}>Добавить курс «ЕГЭ информатика»</Button><Button variant="secondary" icon="plus" onClick={() => setCourseModal({})}>Создать свою</Button></div>} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Select className="w-auto min-w-[220px]" value={course?.id} onChange={(e) => setCourseId(e.target.value)}>
              {db.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            {course && <>
              <IconButton icon="edit" label="Переименовать" onClick={() => setCourseModal({ c: course })} />
              <IconButton icon="copy" label="Копировать как новый шаблон" onClick={() => copyCourse(course)} />
              <IconButton icon="trash" label="Удалить программу" onClick={() => delCourse(course)} />
            </>}
            <div className="ml-auto"><Segmented value={view} onChange={setView} options={[{ id: "program", label: "Темы" }, { id: "matrix", label: "Ученики × темы" }]} /></div>
          </div>
          {course?.description && <p className="mb-4 text-sm text-graphite">{course.description}</p>}

          {view === "program" ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                {sections.map((sec) => (
                  <Card key={sec} title={sec} padded={false}>
                    <ul className="divide-y divide-line">
                      {topics.filter((t) => t.section === sec).map((t) => (
                        <li key={t.id} className="flex items-center gap-1 px-4 py-1.5 text-sm">
                          <span className="flex-1">{t.name}</span>
                          <span className="mr-2 text-xs text-graphite">{db.materials.filter((m) => m.topic_ids.includes(t.id)).length || ""}{db.materials.some((m) => m.topic_ids.includes(t.id)) ? " мат." : ""}</span>
                          <IconButton icon="left" label="Выше" className="rotate-90 p-1" onClick={() => move(t, -1)} />
                          <IconButton icon="right" label="Ниже" className="rotate-90 p-1" onClick={() => move(t, 1)} />
                          <IconButton icon="edit" label="Изменить" className="p-1" onClick={() => setEditTopic(t)} />
                          <IconButton icon="trash" label="Удалить" className="p-1" onClick={() => delTopic(t)} />
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
                {!topics.length && <Empty icon="book" title="В программе пока нет тем" text="Добавьте первую тему справа." />}
              </div>
              <div className="space-y-4">
                <Card title="Добавить тему">
                  <div className="space-y-3">
                    <Field label="Раздел">
                      <Input list="sections" value={newTopic.section} onChange={(e) => setNewTopic({ ...newTopic, section: e.target.value })} placeholder="Блок 1" />
                      <datalist id="sections">{sections.map((s) => <option key={s} value={s} />)}</datalist>
                    </Field>
                    <Field label="Тема"><Input value={newTopic.name} onChange={(e) => setNewTopic({ ...newTopic, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addTopic()} placeholder="Python. Цикл for" /></Field>
                    <Button icon="plus" onClick={addTopic} disabled={!newTopic.name.trim()} className="w-full">Добавить</Button>
                  </div>
                </Card>
                <Card title="Ученики на программе">
                  {students.length ? (
                    <ul className="space-y-3">
                      {students.map((s) => {
                        const p = progress(db, s.id);
                        return (
                          <li key={s.id}>
                            <Link href={`/students/view?id=${s.id}&tab=topics`} className="text-sm font-medium hover:underline">{s.full_name}</Link>
                            <div className="flex items-center gap-2"><Progress value={p.percent} className="flex-1" /><span className="text-xs text-graphite">{Math.round(p.percent)}%</span></div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : <p className="text-sm text-graphite">Назначьте программу ученику в его карточке (вкладка «Темы»).</p>}
                </Card>
              </div>
            </div>
          ) : (
            <Card padded={false}>
              {students.length && topics.length ? (
                <div className="overflow-x-auto">
                  <table className="text-xs">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-10 min-w-[180px] bg-surface p-2 text-left">Тема</th>
                        {students.map((s) => <th key={s.id} className="p-2 text-center font-medium"><Link href={`/students/view?id=${s.id}&tab=topics`} className="hover:underline">{s.full_name.split(" ").slice(0, 2).reverse().join(" ")}</Link></th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {sections.map((sec) => [
                        <tr key={sec}><td colSpan={students.length + 1} className="bg-mist px-2 py-1 font-semibold text-graphite">{sec}</td></tr>,
                        ...topics.filter((t) => t.section === sec).map((t) => (
                          <tr key={t.id}>
                            <td className="sticky left-0 bg-surface px-2 py-1">{t.name}</td>
                            {students.map((s) => {
                              const st = topicStatus(db, s.id, t.id);
                              const sc = topicScores(db, s.id).get(t.id);
                              return (
                                <td key={s.id} className="p-0.5">
                                  <div title={`${TOPIC_STATUS[st].label}${sc ? ` · ${Math.round(sc.avg)}%` : ""}`} className={`mx-auto flex h-6 min-w-[56px] items-center justify-center rounded ${TOPIC_STATUS[st].cell}`}>
                                    {sc ? `${Math.round(sc.avg)}%` : ""}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        )),
                      ])}
                    </tbody>
                  </table>
                </div>
              ) : <Empty icon="users" title="Нет учеников на этой программе" />}
              <div className="flex flex-wrap gap-3 border-t border-line p-3 text-xs">
                {Object.entries(TOPIC_STATUS).map(([k, v]) => <span key={k} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${v.cell}`} />{v.label}</span>)}
                <Badge>число — средний % по проверкам</Badge>
              </div>
            </Card>
          )}
        </>
      )}

      {courseModal && <CourseModal c={courseModal.c} onClose={(id) => { setCourseModal(null); if (id) setCourseId(id); }} />}
      {editTopic && (
        <TopicEdit t={editTopic} sections={sections} onClose={() => setEditTopic(null)} />
      )}
    </>
  );
}

function CourseModal({ c, onClose }: { c?: Course; onClose: (id?: string) => void }) {
  const { db, insert, update } = useStore();
  const [x, setX] = useState<Course>(c ?? { id: uid(), subject_id: db.subjects[0]?.id ?? null, name: "", description: "" });
  const save = async () => {
    if (c) await update("courses", x.id, x);
    else await insert("courses", x);
    onClose(x.id);
  };
  return (
    <Modal open onClose={() => onClose()} title={c ? "Программа" : "Новая программа"}
      footer={<><Button variant="secondary" onClick={() => onClose()}>Отмена</Button><Button onClick={save} disabled={!x.name.trim()}>Сохранить</Button></>}>
      <div className="space-y-3">
        <Field label="Название"><Input value={x.name} onChange={(e) => setX({ ...x, name: e.target.value })} placeholder="ЕГЭ информатика" /></Field>
        <Field label="Предмет">
          <Select value={x.subject_id ?? ""} onChange={(e) => setX({ ...x, subject_id: e.target.value || null })}>
            <option value="">—</option>{db.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Описание"><Textarea value={x.description} onChange={(e) => setX({ ...x, description: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function TopicEdit({ t, sections, onClose }: { t: Topic; sections: string[]; onClose: () => void }) {
  const { update } = useStore();
  const [x, setX] = useState(t);
  return (
    <Modal open onClose={onClose} title="Тема"
      footer={<><Button variant="secondary" onClick={onClose}>Отмена</Button><Button onClick={async () => { await update("topics", t.id, { name: x.name, section: x.section }); onClose(); }}>Сохранить</Button></>}>
      <div className="space-y-3">
        <Field label="Раздел"><Input list="sections2" value={x.section} onChange={(e) => setX({ ...x, section: e.target.value })} /><datalist id="sections2">{sections.map((s) => <option key={s} value={s} />)}</datalist></Field>
        <Field label="Название"><Input value={x.name} onChange={(e) => setX({ ...x, name: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
