"use client";

import { useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import {
  Assessment, AssessmentKind, Attachment, DB, Homework, HomeworkStatus, Lesson, LessonStatus, Payment, PaymentKind, PaymentMethod,
  Student, Subscription, TopicStatus,
} from "@/lib/types";
import {
  ASSESSMENT_KIND, HW_STATUS, LESSON_STATUS, PAYMENT_KIND, PAYMENT_METHOD, STUDENT_STATUS, TOPIC_STATUS, conflicts, convertScore,
  generateSeriesLessons, isLateCancel, ledger, newLesson, studentDuration, studentPrice, studentTopicList,
} from "@/lib/logic";
import { cls, addDays, addMonths, combine, fmtDate, fmtTime, rub, todayYmd, uid, ymd, WEEKDAYS, weekdayMon, parseYmd } from "@/lib/utils";
import { Badge, Button, Checkbox, Field, Input, Modal, MultiPick, Select, Textarea, useConfirm } from "./ui";
import { Icon } from "./Icon";
import { CodeViewer, KindTag, fileKind } from "./files";

// ---------------------------------------------------------------- общие

export function topicOptions(db: DB, studentId?: string) {
  const own = studentId ? studentTopicList(db, studentId) : [];
  const list = own.length ? own : db.topics;
  return list.map((t) => {
    const course = db.courses.find((c) => c.id === t.course_id);
    return { id: t.id, label: t.name, group: own.length ? t.section : `${course?.name ?? ""} · ${t.section}` };
  });
}

export function StudentSelect({ value, onChange, includeInactive, allowEmpty }: { value: string; onChange: (id: string) => void; includeInactive?: boolean; allowEmpty?: string }) {
  const { db } = useStore();
  const list = db.students.filter((s) => includeInactive || s.status !== "finished" || s.id === value).sort((a, b) => a.full_name.localeCompare(b.full_name));
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty != null ? <option value="">{allowEmpty}</option> : !value && <option value="">Выберите ученика</option>}
      {list.map((s) => <option key={s.id} value={s.id}>{s.full_name}{s.status !== "active" ? ` (${STUDENT_STATUS[s.status].label.toLowerCase()})` : ""}</option>)}
    </Select>
  );
}

/** bare — строки прямо на линиях родителя, без собственной рамки (внутри списков занятий) */
export function Attachments({ value, onChange, readOnly, accept, bare }: { value: Attachment[]; onChange?: (v: Attachment[]) => void; readOnly?: boolean; accept?: string; bare?: boolean }) {
  const { backend, toast } = useStore();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<Attachment | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const open = async (a: Attachment) => {
    // код открывается во встроенном просмотрщике с подсветкой, остальное — в новой вкладке
    if (fileKind(a).code) return setViewing(a);
    try {
      const href = await backend!.fileUrl(a);
      if (href.startsWith("data:")) {
        const w = window.open();
        if (w) w.document.write(`<iframe src="${href}" style="border:0;width:100%;height:100%"></iframe>`);
      } else window.open(href, "_blank", "noopener");
    } catch (e) {
      toast(`Не удалось открыть «${a.name}»: ${(e as Error).message}`, "error");
    }
  };
  const addLink = () => {
    const u = url.trim();
    if (!u) return;
    const href = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    let name = href;
    try { const x = new URL(href); name = x.hostname + (x.pathname.length > 1 ? x.pathname : ""); } catch {}
    onChange?.([...value, { name, url: href }]);
    setUrl("");
  };
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const added: Attachment[] = [];
      for (const f of Array.from(files)) added.push(await backend!.upload(f));
      onChange?.([...value, ...added]);
    } catch (e) {
      toast(`Файл не загрузился: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className={bare ? "divide-y divide-line border-t border-line" : "divide-y divide-line overflow-hidden rounded-xl border border-line bg-paper"}>
          {value.map((a, i) => (
            <li key={i} className={cls("flex min-h-[48px] items-center gap-3", bare ? "px-0" : "px-3")}>
              <KindTag a={a} />
              <button type="button" onClick={() => open(a)} className="min-w-0 flex-1 truncate py-2 text-left text-sm font-medium hover:text-accent">{a.name}</button>
              <span className="hidden text-xs text-graphite sm:inline">{fileKind(a).code ? "открыть код" : fileKind(a).link ? "перейти" : "открыть"}</span>
              {!readOnly && (
                <button type="button" onClick={() => onChange?.(value.filter((_, j) => j !== i))} className="flex h-8 w-8 items-center justify-center rounded-full text-graphite hover:bg-mist hover:text-signal" aria-label={`Убрать ${a.name}`}>
                  <Icon name="x" className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Ссылка: https://…" aria-label="Ссылка на материал" className="min-w-0 flex-1" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLink())} />
          <Button variant="secondary" icon="link" onClick={addLink} disabled={!url.trim()}>Добавить ссылку</Button>
          <Button variant="secondary" icon="upload" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? "Загружаю…" : "Загрузить файлы"}</Button>
          <input ref={fileRef} type="file" multiple hidden accept={accept} onChange={(e) => upload(e.target.files)} />
        </div>
      )}
      {viewing && <CodeViewer attachment={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- ученик

const emptyStudent = (): Student => ({
  id: uid(), full_name: "", grade: "", goal: "", phone: "", telegram: "", whatsapp: "", parent_name: "", parent_phone: "",
  parent_telegram: "", parent_whatsapp: "", price: null, duration: null, format: "online", start_date: todayYmd(), status: "active",
  notes: "", portal_emails: [], color: ["#357e81", "#b45309", "#6d28d9", "#be123c", "#0369a1", "#15803d"][Math.floor(Math.random() * 6)],
});

export function StudentModal({ open, onClose, student, onSaved }: { open: boolean; onClose: () => void; student?: Student; onSaved?: (id: string) => void }) {
  const { insert, update, settings, db } = useStore();
  const [s, setS] = useState<Student>(student ?? emptyStudent());
  const [courseId, setCourseId] = useState("");
  const [emails, setEmails] = useState((student?.portal_emails ?? []).join(", "));
  const set = <K extends keyof Student>(k: K, v: Student[K]) => setS((x) => ({ ...x, [k]: v }));
  const save = async () => {
    const row = { ...s, full_name: s.full_name.trim(), portal_emails: emails.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean) };
    if (student) await update("students", s.id, row);
    else {
      await insert("students", row);
      if (courseId) await insert("student_courses", { id: uid(), student_id: s.id, course_id: courseId });
    }
    onSaved?.(s.id);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={student ? "Редактировать ученика" : "Новый ученик"} wide
      footer={<><Button variant="secondary" onClick={onClose}>Отмена</Button><Button onClick={save} disabled={!s.full_name.trim()}>Сохранить</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ФИО *" className="sm:col-span-2"><Input value={s.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="Фамилия Имя Отчество" /></Field>
        <Field label="Класс / уровень"><Input value={s.grade} onChange={(e) => set("grade", e.target.value)} placeholder="9" /></Field>
        <Field label="Цель"><Input value={s.goal} onChange={(e) => set("goal", e.target.value)} placeholder="ЕГЭ на 80+" /></Field>
        <Field label="Телефон ученика"><Input type="tel" value={s.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Telegram ученика"><Input value={s.telegram} onChange={(e) => set("telegram", e.target.value)} placeholder="@username" /></Field>
        <Field label="WhatsApp ученика"><Input value={s.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+7…" /></Field>
        <Field label="Родитель (ФИО)"><Input value={s.parent_name} onChange={(e) => set("parent_name", e.target.value)} /></Field>
        <Field label="Телефон родителя"><Input type="tel" value={s.parent_phone} onChange={(e) => set("parent_phone", e.target.value)} /></Field>
        <Field label="Telegram родителя"><Input value={s.parent_telegram} onChange={(e) => set("parent_telegram", e.target.value)} /></Field>
        <Field label="WhatsApp родителя"><Input value={s.parent_whatsapp} onChange={(e) => set("parent_whatsapp", e.target.value)} /></Field>
        <Field label="Формат">
          <Select value={s.format} onChange={(e) => set("format", e.target.value as Student["format"])}><option value="online">Онлайн</option><option value="offline">Очно</option></Select>
        </Field>
        <Field label={`Стоимость занятия, ₽ (по умолч. ${settings.default_price})`}>
          <Input type="number" min={0} value={s.price ?? ""} onChange={(e) => set("price", e.target.value === "" ? null : Number(e.target.value))} placeholder={String(settings.default_price)} />
        </Field>
        <Field label={`Длительность, мин (по умолч. ${settings.default_duration})`}>
          <Input type="number" min={15} step={5} value={s.duration ?? ""} onChange={(e) => set("duration", e.target.value === "" ? null : Number(e.target.value))} placeholder={String(settings.default_duration)} />
        </Field>
        <Field label="Начало занятий"><Input type="date" value={s.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
        <Field label="Статус">
          <Select value={s.status} onChange={(e) => set("status", e.target.value as Student["status"])}>
            {Object.entries(STUDENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </Field>
        {!student && (
          <Field label="Программа">
            <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">Назначить позже</option>
              {db.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="E-mail для личного кабинета" className="sm:col-span-2" hint="Ученик и/или родитель смогут войти с этими адресами и видеть расписание, прогресс, ДЗ и баланс. Несколько — через запятую.">
          <Input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="student@mail.ru, parent@mail.ru" />
        </Field>
        <Field label="Заметки" className="sm:col-span-2"><Textarea value={s.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- занятие

export function LessonModal({ open, onClose, lesson, preset, report }: {
  open: boolean; onClose: () => void; lesson?: Lesson; preset?: { student_id?: string; date?: string; time?: string }; report?: boolean;
}) {
  const { db, settings, insert, update, remove, toast } = useStore();
  const confirm = useConfirm();
  const isNew = !lesson;
  const [studentId, setStudentId] = useState(lesson?.student_id ?? preset?.student_id ?? "");
  const student = db.students.find((s) => s.id === studentId);
  const start = lesson ? new Date(lesson.starts_at) : null;
  const [date, setDate] = useState(start ? ymd(start) : preset?.date ?? todayYmd());
  const [time, setTime] = useState(start ? fmtTime(start) : preset?.time ?? "16:00");
  const [duration, setDuration] = useState(lesson?.duration ?? 0);
  const [price, setPrice] = useState<number | "">(lesson?.price ?? "");
  const [status, setStatus] = useState<LessonStatus>(report ? "done" : lesson?.status ?? "planned");
  const [lateCancel, setLateCancel] = useState(lesson?.late_cancel ?? false);
  const [repeat, setRepeat] = useState(false);
  const [until, setUntil] = useState(ymd(addMonths(new Date(), 3)));
  const [topicIds, setTopicIds] = useState<string[]>(lesson?.topic_ids ?? []);
  const [topicNewStatus, setTopicNewStatus] = useState<TopicStatus | "">("in_progress");
  const [covered, setCovered] = useState(lesson?.report_covered ?? "");
  const [hwText, setHwText] = useState(lesson?.report_homework ?? "");
  const existingHw = lesson ? db.homework.find((h) => h.lesson_id === lesson.id) : undefined;
  const nextLesson = lesson ? db.lessons.filter((l) => l.student_id === lesson.student_id && l.starts_at > lesson.starts_at && l.status === "planned").sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] : undefined;
  const [hwDue, setHwDue] = useState(existingHw?.due_date ?? (nextLesson ? ymd(new Date(nextLesson.starts_at)) : ymd(addDays(new Date(), 7))));
  const [comment, setComment] = useState(lesson?.comment ?? "");
  const [materials, setMaterials] = useState<Attachment[]>(lesson?.attachments ?? []);
  const [grade, setGrade] = useState<number | null>(lesson?.grade ?? null);
  const [tab, setTab] = useState<"main" | "report">(report ? "report" : "main");

  const effDuration = duration || studentDuration(student, settings);
  const effPrice = price === "" ? studentPrice(student, settings) : price;
  const startsAt = combine(date, time);
  const clash = studentId ? conflicts(db, startsAt, effDuration, lesson?.id) : [];
  const showReport = status === "done" || tab === "report";

  const changeStatus = (s: LessonStatus) => {
    setStatus(s);
    if (s === "cancelled_student") setLateCancel(isLateCancel(startsAt, settings));
    if (s === "done") setTab("report");
  };

  const save = async () => {
    if (!studentId) return;
    const base = {
      student_id: studentId, starts_at: startsAt, duration: effDuration, price: effPrice, status, late_cancel: status === "cancelled_student" && lateCancel,
      topic_ids: topicIds, report_covered: covered, report_homework: hwText, comment, grade, attachments: materials,
    };
    let lessonId = lesson?.id;
    if (isNew && repeat) {
      const series = { id: uid(), student_id: studentId, weekday: weekdayMon(parseYmd(date)), time, duration: effDuration, start_date: date, end_date: until };
      await insert("lesson_series", series);
      const lessons = generateSeriesLessons(series, effPrice, db.lessons);
      await insert("lessons", lessons);
      toast(`Создано занятий: ${lessons.length}`);
      onClose();
      return;
    }
    if (isNew) {
      const l = newLesson({ ...base });
      lessonId = l.id;
      await insert("lessons", l);
    } else await update("lessons", lesson.id, base);

    if (status === "done") {
      // статусы тем
      if (topicNewStatus) {
        for (const tid of topicIds) {
          const ex = db.student_topics.find((x) => x.student_id === studentId && x.topic_id === tid);
          const order: TopicStatus[] = ["not_started", "in_progress", "review", "passed", "mastered"];
          if (ex) {
            if (topicNewStatus === "review" || order.indexOf(topicNewStatus) > order.indexOf(ex.status))
              await update("student_topics", ex.id, { status: topicNewStatus, updated_at: todayYmd() });
          } else await insert("student_topics", { id: uid(), student_id: studentId, topic_id: tid, status: topicNewStatus, updated_at: todayYmd() });
        }
      }
      // домашнее задание
      if (hwText.trim()) {
        if (existingHw) await update("homework", existingHw.id, { description: hwText, due_date: hwDue, topic_ids: topicIds });
        else
          await insert("homework", {
            id: uid(), student_id: studentId, lesson_id: lessonId!, title: `ДЗ к занятию ${fmtDate(date)}`, description: hwText, topic_ids: topicIds,
            assigned_at: date, due_date: hwDue, attachments: [], status: "assigned", grade: null, comment: "",
          } as Homework);
      }
    }
    toast("Сохранено");
    onClose();
  };

  const del = async () => {
    if (!lesson) return;
    if (lesson.series_id) {
      const future = db.lessons.filter((l) => l.series_id === lesson.series_id && l.starts_at >= lesson.starts_at && l.status === "planned");
      if (future.length > 1 && (await confirm({ title: "Удалить серию?", text: `Это регулярное занятие. Удалить его и все будущие запланированные занятия серии (${future.length})? Нажмите «Отмена», чтобы удалить только это занятие.`, ok: "Удалить серию" }))) {
        await remove("lessons", future.map((l) => l.id));
        const series = db.lesson_series.find((s) => s.id === lesson.series_id);
        if (series) await update("lesson_series", series.id, { end_date: ymd(addDays(new Date(lesson.starts_at), -1)) });
        onClose();
        return;
      }
    }
    if (await confirm({ title: "Удалить занятие?", text: `${student?.full_name ?? ""}, ${fmtDate(lesson.starts_at)} ${fmtTime(lesson.starts_at)}. Если занятие проведено, удаление изменит баланс ученика.` })) {
      await remove("lessons", lesson.id);
      onClose();
    }
  };

  const options = useMemo(() => topicOptions(db, studentId), [db, studentId]);

  return (
    <Modal open={open} onClose={onClose} wide={showReport} title={isNew ? "Новое занятие" : report ? "Отчёт о занятии" : "Занятие"}
      footer={<>
        {!isNew && <Button variant="ghost" icon="trash" className="mr-auto text-signal" onClick={del}>Удалить</Button>}
        <Button variant="secondary" onClick={onClose}>Отмена</Button>
        <Button onClick={save} disabled={!studentId}>Сохранить</Button>
      </>}>
      {!isNew && (
        <div className="mb-4 flex gap-1 rounded-lg bg-mist p-0.5">
          {(["main", "report"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`flex-1 rounded-md py-1.5 text-sm font-medium ${tab === t ? "bg-surface " : "text-graphite"}`}>
              {t === "main" ? "Занятие" : "Отчёт"}
            </button>
          ))}
        </div>
      )}
      {(isNew || tab === "main") && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ученик" className="sm:col-span-2"><StudentSelect value={studentId} onChange={(id) => { setStudentId(id); setPrice(""); setDuration(0); setTopicIds([]); }} /></Field>
          <Field label="Дата"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Время"><Input type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} /></Field>
          <Field label="Длительность, мин"><Input type="number" min={15} step={5} value={effDuration} onChange={(e) => setDuration(Number(e.target.value))} /></Field>
          <Field label="Стоимость, ₽" hint={ledger(db, studentId, settings).activeSub ? "Если действует абонемент, спишется занятие из абонемента" : undefined}>
            <Input type="number" min={0} value={effPrice} onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
          {!isNew && (
            <Field label="Статус" className="sm:col-span-2">
              <Select value={status} onChange={(e) => changeStatus(e.target.value as LessonStatus)}>
                {Object.entries(LESSON_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
            </Field>
          )}
          {status === "cancelled_student" && (
            <div className="sm:col-span-2">
              <Checkbox checked={lateCancel} onChange={setLateCancel} label={`Поздняя отмена (менее чем за ${settings.cancel_hours} ч) — занятие оплачивается`} />
            </div>
          )}
          {status === "no_show" && <p className="text-xs text-graphite sm:col-span-2">{settings.charge_no_show ? "Пропуск без предупреждения оплачивается (см. Настройки)." : "Пропуск без предупреждения не оплачивается (см. Настройки)."}</p>}
          {isNew && (
            <div className="space-y-2 sm:col-span-2">
              <Checkbox checked={repeat} onChange={setRepeat} label={<>Повторять каждую неделю ({WEEKDAYS[weekdayMon(parseYmd(date))]}, {time})</>} />
              {repeat && <Field label="До даты"><Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} /></Field>}
            </div>
          )}
          {clash.length > 0 && !repeat && (
            <p className="flex items-center gap-1.5 rounded-lg bg-mist px-3 py-2 text-sm text-ink sm:col-span-2">
              <Icon name="alert" className="w-4 h-4" />Пересекается: {clash.map((c) => `${db.students.find((s) => s.id === c.student_id)?.full_name} ${fmtTime(c.starts_at)}`).join(", ")}
            </p>
          )}
        </div>
      )}
      {!isNew && tab === "report" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="text-sm text-graphite sm:col-span-2">{student?.full_name} · {fmtDate(date)} {time}</div>
          <Field label="Статус"><Select value={status} onChange={(e) => changeStatus(e.target.value as LessonStatus)}>
            {Object.entries(LESSON_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select></Field>
          <Field label="Оценка работы на занятии">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((g) => (
                <button key={g} type="button" onClick={() => setGrade(grade === g ? null : g)}
                  className={`h-10 flex-1 rounded-lg border text-sm font-semibold ${grade === g ? "border-ink bg-ink text-paper" : "border-line"}`}>{g}</button>
              ))}
            </div>
          </Field>
          <Field label="Темы занятия" className="sm:col-span-2"><MultiPick options={options} value={topicIds} onChange={setTopicIds} placeholder="Выберите темы" /></Field>
          {topicIds.length > 0 && status === "done" && (
            <Field label="Отметить темы как" className="sm:col-span-2" hint="Статус темы не понизится (кроме «Требует повторения»)">
              <Select value={topicNewStatus} onChange={(e) => setTopicNewStatus(e.target.value as TopicStatus | "")}>
                <option value="">Не менять</option>
                {(["in_progress", "passed", "review", "mastered"] as TopicStatus[]).map((s) => <option key={s} value={s}>{TOPIC_STATUS[s].label}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Что прошли" className="sm:col-span-2"><Textarea value={covered} onChange={(e) => setCovered(e.target.value)} placeholder="Разобрали теорию, решили задачи №…" /></Field>
          <Field label="Что задано" className="sm:col-span-2" hint={status === "done" ? (existingHw ? "Связанное ДЗ будет обновлено" : "Если заполнено — автоматически создастся домашнее задание") : undefined}>
            <Textarea value={hwText} onChange={(e) => setHwText(e.target.value)} placeholder="№ 12–20 из сборника" />
          </Field>
          {hwText.trim() && status === "done" && <Field label="Срок сдачи ДЗ"><Input type="date" value={hwDue} onChange={(e) => setHwDue(e.target.value)} /></Field>}
          <Field label="Комментарий" className="sm:col-span-2"><Textarea value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
          <div className="sm:col-span-2">
            <div className="mb-1.5 text-sm font-medium">Материалы для повторения</div>
            <p className="mb-2 text-xs text-graphite">Код с занятия, конспект в PDF, презентация или ссылка. Ученик увидит их в своём кабинете у этого занятия.</p>
            <Attachments value={materials} onChange={setMaterials} accept=".py,.pyw,.txt,.c,.cpp,.java,.js,.ts,.pas,.cs,.sql,.csv,.json,.md,.pdf,.ppt,.pptx,.key,.odp,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" />
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- оплата

export function PaymentModal({ open, onClose, payment, studentId }: { open: boolean; onClose: () => void; payment?: Payment; studentId?: string }) {
  const { db, settings, insert, update, remove } = useStore();
  const confirm = useConfirm();
  const [p, setP] = useState<Payment>(payment ?? { id: uid(), student_id: studentId ?? "", date: todayYmd(), amount: 0, method: "transfer", kind: "single", subscription_id: null, comment: "" });
  const student = db.students.find((s) => s.id === p.student_id);
  const price = studentPrice(student, settings);
  const [subCount, setSubCount] = useState(8);
  const [subPrice, setSubPrice] = useState<number | "">("");
  const [subDays, setSubDays] = useState(45);
  const subTotal = subPrice === "" ? subCount * price : subPrice;
  const set = <K extends keyof Payment>(k: K, v: Payment[K]) => setP((x) => ({ ...x, [k]: v }));
  const lg = p.student_id ? ledger(db, p.student_id, settings) : null;

  const save = async () => {
    if (payment) await update("payments", p.id, p);
    else if (p.kind === "subscription") {
      const sub: Subscription = { id: uid(), student_id: p.student_id, lessons_total: subCount, price_total: subTotal, start_date: p.date, expires_at: ymd(addDays(parseYmd(p.date), subDays)) };
      await insert("subscriptions", sub);
      await insert("payments", { ...p, amount: subTotal, subscription_id: sub.id, comment: p.comment || `Абонемент на ${subCount} занятий` });
    } else await insert("payments", p);
    onClose();
  };
  const del = async () => {
    if (payment && (await confirm({ title: "Удалить оплату?", text: `${rub(payment.amount)} от ${fmtDate(payment.date)}. Баланс ученика уменьшится.` }))) {
      await remove("payments", payment.id);
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={payment ? "Оплата" : "Внести оплату"}
      footer={<>
        {payment && <Button variant="ghost" icon="trash" className="mr-auto text-signal" onClick={del}>Удалить</Button>}
        <Button variant="secondary" onClick={onClose}>Отмена</Button>
        <Button onClick={save} disabled={!p.student_id || (p.kind !== "subscription" && p.amount <= 0)}>Сохранить</Button>
      </>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ученик" className="sm:col-span-2"><StudentSelect value={p.student_id} onChange={(id) => set("student_id", id)} includeInactive /></Field>
        {lg && <p className="text-sm sm:col-span-2">Текущий баланс: <b className={lg.balance < 0 ? "text-signal" : ""}>{rub(lg.balance)}</b>{lg.balance < 0 && <button type="button" className="ml-2 text-ink underline underline-offset-4" onClick={() => set("amount", -lg.balance)}>погасить долг</button>}</p>}
        <Field label="За что">
          <Select value={p.kind} disabled={!!payment} onChange={(e) => set("kind", e.target.value as PaymentKind)}>
            {Object.entries(PAYMENT_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Дата"><Input type="date" value={p.date} onChange={(e) => set("date", e.target.value)} /></Field>
        {p.kind === "subscription" && !payment ? (
          <>
            <Field label="Занятий в абонементе">
              <Select value={subCount} onChange={(e) => setSubCount(Number(e.target.value))}>{[4, 8, 12, 16].map((n) => <option key={n} value={n}>{n}</option>)}</Select>
            </Field>
            <Field label="Срок действия, дней"><Input type="number" min={1} value={subDays} onChange={(e) => setSubDays(Number(e.target.value))} /></Field>
            <Field label="Стоимость абонемента, ₽" hint={`Без скидки: ${rub(subCount * price)} · за занятие: ${rub(subTotal / subCount)}`} className="sm:col-span-2">
              <Input type="number" min={0} value={subTotal} onChange={(e) => setSubPrice(e.target.value === "" ? "" : Number(e.target.value))} />
            </Field>
          </>
        ) : (
          <Field label="Сумма, ₽">
            <Input type="number" min={0} value={p.amount || ""} onChange={(e) => set("amount", Number(e.target.value))} placeholder={String(price)} />
          </Field>
        )}
        <Field label="Способ">
          <Select value={p.method} onChange={(e) => set("method", e.target.value as PaymentMethod)}>
            {Object.entries(PAYMENT_METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Комментарий" className="sm:col-span-2"><Input value={p.comment} onChange={(e) => set("comment", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- ДЗ

export function HomeworkModal({ open, onClose, hw, studentId }: { open: boolean; onClose: () => void; hw?: Homework; studentId?: string }) {
  const { db, insert, update, remove } = useStore();
  const confirm = useConfirm();
  const [h, setH] = useState<Homework>(hw ?? {
    id: uid(), student_id: studentId ?? "", lesson_id: null, title: "", description: "", topic_ids: [], assigned_at: todayYmd(),
    due_date: ymd(addDays(new Date(), 7)), attachments: [], status: "assigned", grade: null, comment: "",
  });
  const set = <K extends keyof Homework>(k: K, v: Homework[K]) => setH((x) => ({ ...x, [k]: v }));
  const save = async () => {
    const row = { ...h, title: h.title.trim() || "Домашнее задание" };
    if (hw) await update("homework", h.id, row);
    else await insert("homework", row);
    onClose();
  };
  const del = async () => {
    if (hw && (await confirm({ title: "Удалить домашнее задание?", text: hw.title }))) {
      await remove("homework", hw.id);
      onClose();
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={hw ? "Домашнее задание" : "Новое домашнее задание"} wide
      footer={<>
        {hw && <Button variant="ghost" icon="trash" className="mr-auto text-signal" onClick={del}>Удалить</Button>}
        <Button variant="secondary" onClick={onClose}>Отмена</Button>
        <Button onClick={save} disabled={!h.student_id}>Сохранить</Button>
      </>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ученик"><StudentSelect value={h.student_id} onChange={(id) => set("student_id", id)} /></Field>
        <Field label="Название"><Input value={h.title} onChange={(e) => set("title", e.target.value)} placeholder="Домашнее задание" /></Field>
        <Field label="Описание" className="sm:col-span-2"><Textarea rows={4} value={h.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field label="Темы" className="sm:col-span-2"><MultiPick options={topicOptions(db, h.student_id)} value={h.topic_ids} onChange={(v) => set("topic_ids", v)} /></Field>
        <Field label="Выдано"><Input type="date" value={h.assigned_at} onChange={(e) => set("assigned_at", e.target.value)} /></Field>
        <Field label="Срок сдачи"><Input type="date" value={h.due_date} onChange={(e) => set("due_date", e.target.value)} /></Field>
        <Field label="Файлы и ссылки" className="sm:col-span-2"><Attachments value={h.attachments} onChange={(v) => set("attachments", v)} /></Field>
        <Field label="Статус">
          <Select value={h.status} onChange={(e) => set("status", e.target.value as HomeworkStatus)}>
            {(["assigned", "submitted", "checked", "missed"] as HomeworkStatus[]).map((s) => <option key={s} value={s}>{HW_STATUS[s].label}</option>)}
          </Select>
        </Field>
        <Field label="Оценка">
          <Select value={h.grade ?? ""} onChange={(e) => set("grade", e.target.value ? Number(e.target.value) : null)}>
            <option value="">—</option>{[5, 4, 3, 2, 1].map((g) => <option key={g} value={g}>{g}</option>)}
          </Select>
        </Field>
        <Field label="Комментарий после проверки" className="sm:col-span-2"><Textarea value={h.comment} onChange={(e) => set("comment", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- проверка знаний

export function AssessmentModal({ open, onClose, a, studentId }: { open: boolean; onClose: () => void; a?: Assessment; studentId?: string }) {
  const { db, settings, insert, update, remove } = useStore();
  const confirm = useConfirm();
  const [x, setX] = useState<Assessment>(a ?? {
    id: uid(), student_id: studentId ?? "", date: todayYmd(), title: "", kind: "test", topic_ids: [], max_score: 10, score: 0, comment: "",
    exam_scale: null, quiz_id: null, answers: null, question_points: null, topic_results: null,
  });
  const set = <K extends keyof Assessment>(k: K, v: Assessment[K]) => setX((p) => ({ ...p, [k]: v }));
  const scale = settings.exam_scales.find((s) => s.key === x.exam_scale);
  const perTopic = x.topic_results ?? {};
  const save = async () => {
    const tr = Object.keys(perTopic).length ? Object.fromEntries(Object.entries(perTopic).filter(([k]) => x.topic_ids.includes(k))) : null;
    const row = { ...x, title: x.title.trim() || ASSESSMENT_KIND[x.kind], topic_results: tr && Object.keys(tr).length ? tr : null };
    if (a) await update("assessments", x.id, row);
    else await insert("assessments", row);
    onClose();
  };
  const del = async () => {
    if (a && (await confirm({ title: "Удалить результат?", text: `${a.title} от ${fmtDate(a.date)}` }))) {
      await remove("assessments", a.id);
      onClose();
    }
  };
  const percent = x.max_score ? Math.round((x.score / x.max_score) * 100) : 0;
  return (
    <Modal open={open} onClose={onClose} title={a ? "Результат проверки" : "Новая проверка знаний"} wide
      footer={<>
        {a && <Button variant="ghost" icon="trash" className="mr-auto text-signal" onClick={del}>Удалить</Button>}
        <Button variant="secondary" onClick={onClose}>Отмена</Button>
        <Button onClick={save} disabled={!x.student_id || x.max_score <= 0}>Сохранить</Button>
      </>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ученик"><StudentSelect value={x.student_id} onChange={(id) => set("student_id", id)} /></Field>
        <Field label="Вид">
          <Select value={x.kind} onChange={(e) => {
            const k = e.target.value as AssessmentKind;
            setX((p) => ({ ...p, kind: k, exam_scale: k === "exam" ? settings.exam_scales[0]?.key ?? null : null, max_score: k === "exam" ? settings.exam_scales[0]?.max ?? p.max_score : p.max_score }));
          }}>
            {(["test", "control", "exam"] as AssessmentKind[]).map((k) => <option key={k} value={k}>{ASSESSMENT_KIND[k]}</option>)}
            {x.kind === "quiz" && <option value="quiz">{ASSESSMENT_KIND.quiz}</option>}
          </Select>
        </Field>
        <Field label="Название"><Input value={x.title} onChange={(e) => set("title", e.target.value)} placeholder={ASSESSMENT_KIND[x.kind]} /></Field>
        <Field label="Дата"><Input type="date" value={x.date} onChange={(e) => set("date", e.target.value)} /></Field>
        {x.kind === "exam" && (
          <Field label="Шкала перевода баллов" className="sm:col-span-2">
            <Select value={x.exam_scale ?? ""} onChange={(e) => { const s = settings.exam_scales.find((z) => z.key === e.target.value); setX((p) => ({ ...p, exam_scale: e.target.value || null, max_score: s?.max ?? p.max_score })); }}>
              <option value="">Без перевода</option>
              {settings.exam_scales.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label={x.kind === "exam" ? "Первичный балл" : "Получено баллов"}><Input type="number" min={0} value={x.score} onChange={(e) => set("score", Number(e.target.value))} /></Field>
        <Field label="Максимум"><Input type="number" min={1} value={x.max_score} onChange={(e) => set("max_score", Number(e.target.value))} /></Field>
        <div className="flex flex-wrap items-center gap-2 text-sm sm:col-span-2">
          <Badge color={percent >= settings.weak_threshold ? "green" : percent >= 50 ? "amber" : "red"}>{percent}%</Badge>
          {scale && <span>Перевод: <b>{convertScore(scale, x.score)}</b> {scale.name.includes("оценка") ? "(оценка)" : "вторичных баллов"}</span>}
        </div>
        <Field label="Темы" className="sm:col-span-2"><MultiPick options={topicOptions(db, x.student_id)} value={x.topic_ids} onChange={(v) => set("topic_ids", v)} /></Field>
        {x.topic_ids.length > 1 && (
          <div className="space-y-2 sm:col-span-2">
            <p className="text-xs text-graphite">Результат по темам, % (необязательно; если пусто — для всех тем берётся общий процент)</p>
            {x.topic_ids.map((tid) => (
              <div key={tid} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">{db.topics.find((t) => t.id === tid)?.name}</span>
                <Input type="number" min={0} max={100} className="w-24" value={perTopic[tid] ?? ""} placeholder={String(percent)}
                  onChange={(e) => { const v = e.target.value; const next = { ...perTopic }; if (v === "") delete next[tid]; else next[tid] = Number(v); set("topic_results", next); }} />
              </div>
            ))}
          </div>
        )}
        <Field label="Комментарий" className="sm:col-span-2"><Textarea value={x.comment} onChange={(e) => set("comment", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

/** Ссылки «написать» для мессенджеров */
export function contactLinks(phone: string, telegram: string, whatsapp: string) {
  const res: { label: string; href: string; icon: "phone" | "send" | "message" }[] = [];
  const digits = (s: string) => s.replace(/[^\d]/g, "").replace(/^8(\d{10})$/, "7$1");
  if (phone) res.push({ label: phone, href: `tel:${phone.replace(/[^\d+]/g, "")}`, icon: "phone" });
  if (telegram) res.push({ label: "Telegram", href: telegram.startsWith("@") ? `https://t.me/${telegram.slice(1)}` : /^\+?\d/.test(telegram) ? `https://t.me/+${digits(telegram)}` : `https://t.me/${telegram}`, icon: "send" });
  if (whatsapp) res.push({ label: "WhatsApp", href: `https://wa.me/${digits(whatsapp)}`, icon: "message" });
  return res;
}
