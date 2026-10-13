"use client";

import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { DB, ExamScale, SettingsData, TABLES } from "@/lib/types";
import { downloadFile, todayYmd, uid } from "@/lib/utils";
import { Button, Card, Checkbox, Field, IconButton, Input, PageHeader, Segmented, useConfirm } from "@/components/ui";
import { useTheme, type Theme } from "@/components/Providers";

export default function SettingsPage() {
  const { db, settings, saveSettings, insert, update, remove, replaceAll, loadDemo, backend, session, toast } = useStore();
  const confirm = useConfirm();
  const { theme, setTheme } = useTheme();
  const [s, setS] = useState<SettingsData>(settings);
  const [subject, setSubject] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(s) !== JSON.stringify(settings);
  const set = <K extends keyof SettingsData>(k: K, v: SettingsData[K]) => setS((x) => ({ ...x, [k]: v }));
  const setScale = (i: number, patch: Partial<ExamScale>) => set("exam_scales", s.exam_scales.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const exportJson = () => {
    const data: Partial<DB> & { _meta: object } = { _meta: { app: "tutor-cabinet", version: 1, exported_at: new Date().toISOString() } };
    TABLES.forEach((t) => ((data as Record<string, unknown>)[t] = db[t]));
    downloadFile(`tutor-backup-${todayYmd()}.json`, JSON.stringify(data, null, 2), "application/json");
  };
  const importJson = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || !Array.isArray(data.students)) throw new Error("Файл не похож на резервную копию");
      if (await confirm({ title: "Восстановить из резервной копии?", text: `Все текущие данные будут заменены данными из файла «${f.name}» (${data.students.length} учеников). Рекомендуем сначала сделать экспорт.`, ok: "Заменить данные" }))
        await replaceAll(data as DB);
    } catch (e) {
      toast(`Не удалось прочитать файл: ${(e as Error).message}`, "error");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <PageHeader title="Настройки" actions={dirty && <Button onClick={() => saveSettings(s).then(() => toast("Настройки сохранены"))}>Сохранить изменения</Button>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Занятия и оплата">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ваше имя (для отчётов)" className="sm:col-span-2"><Input value={s.tutor_name} onChange={(e) => set("tutor_name", e.target.value)} placeholder="Анна Сергеевна" /></Field>
            <Field label="Стоимость по умолчанию, ₽"><Input type="number" min={0} value={s.default_price} onChange={(e) => set("default_price", Number(e.target.value))} /></Field>
            <Field label="Длительность по умолчанию, мин"><Input type="number" min={15} step={5} value={s.default_duration} onChange={(e) => set("default_duration", Number(e.target.value))} /></Field>
            <Field label="Бесплатная отмена не позднее, чем за (ч)" hint="Отмена учеником позже — занятие оплачивается"><Input type="number" min={0} value={s.cancel_hours} onChange={(e) => set("cancel_hours", Number(e.target.value))} /></Field>
            <div className="flex items-center"><Checkbox checked={s.charge_no_show} onChange={(v) => set("charge_no_show", v)} label="Пропуск без предупреждения оплачивается" /></div>
          </div>
        </Card>
        <Card title="Контроль знаний">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Напоминать о проверке через, дней"><Input type="number" min={1} value={s.stale_check_days} onChange={(e) => set("stale_check_days", Number(e.target.value))} /></Field>
            <Field label="Порог «слабой темы», %"><Input type="number" min={1} max={100} value={s.weak_threshold} onChange={(e) => set("weak_threshold", Number(e.target.value))} /></Field>
          </div>
          <h3 className="mb-2 mt-4 text-sm font-semibold">Шкалы перевода баллов</h3>
          <p className="mb-2 text-xs text-graphite">Формат: «первичный:результат» через запятую. Берётся значение для ближайшего порога не выше набранного балла. Сверьте шкалу с официальной на текущий год.</p>
          <div className="space-y-3">
            {s.exam_scales.map((x, i) => (
              <div key={x.key} className="rounded-lg border border-line p-2">
                <div className="flex gap-2">
                  <Input value={x.name} onChange={(e) => setScale(i, { name: e.target.value })} />
                  <Input type="number" className="w-20" value={x.max} onChange={(e) => setScale(i, { max: Number(e.target.value) })} title="Максимальный первичный балл" />
                  <IconButton icon="trash" label="Удалить шкалу" onClick={() => set("exam_scales", s.exam_scales.filter((_, j) => j !== i))} />
                </div>
                <Input className="mt-2 font-mono text-xs" value={x.map} onChange={(e) => setScale(i, { map: e.target.value })} />
              </div>
            ))}
            <Button size="sm" variant="secondary" icon="plus" onClick={() => set("exam_scales", [...s.exam_scales, { key: uid(), name: "Новая шкала", max: 30, map: "0:2,10:3,20:4,25:5" }])}>Шкала</Button>
          </div>
        </Card>

        <Card title="Предметы">
          <ul className="mb-3 space-y-1">
            {db.subjects.map((x) => (
              <li key={x.id} className="flex items-center gap-2">
                <Input defaultValue={x.name} onBlur={(e) => e.target.value.trim() && e.target.value !== x.name && update("subjects", x.id, { name: e.target.value.trim() })} />
                <IconButton icon="trash" label="Удалить" onClick={async () => (await confirm({ title: "Удалить предмет?", text: `«${x.name}». Программы останутся, но без предмета.` })) && (await Promise.all(db.courses.filter((c) => c.subject_id === x.id).map((c) => update("courses", c.id, { subject_id: null }))), remove("subjects", x.id))} />
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Математика" />
            <Button icon="plus" disabled={!subject.trim()} onClick={() => { insert("subjects", { id: uid(), name: subject.trim() }); setSubject(""); }}>Добавить</Button>
          </div>
          <p className="mt-2 text-xs text-graphite">Темы и разделы — в разделе «Программа».</p>
        </Card>

        <Card title="Оформление">
          <Segmented<Theme> value={theme} onChange={setTheme} options={[{ id: "light", label: "Светлая" }, { id: "dark", label: "Тёмная" }, { id: "system", label: "Как в системе" }]} />
        </Card>

        <Card title="Резервное копирование">
          <p className="mb-3 text-sm text-graphite dark:text-graphite">Экспорт сохраняет все данные (учеников, занятия, оплаты, оценки, ДЗ, темы, материалы, настройки) в один JSON-файл. Импорт полностью заменяет текущие данные.</p>
          <div className="flex flex-wrap gap-2">
            <Button icon="download" onClick={exportJson}>Экспорт в JSON</Button>
            <Button variant="secondary" icon="upload" onClick={() => fileRef.current?.click()}>Импорт из JSON</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => importJson(e.target.files?.[0])} />
          </div>
          <p className="mt-2 text-xs text-graphite">Файлы, загруженные в хранилище Supabase, в JSON не входят — только ссылки на них.</p>
        </Card>

        <Card title="Данные">
          <p className="mb-3 text-sm text-graphite dark:text-graphite">
            {backend?.mode === "local"
              ? "Демо-режим: данные хранятся только в этом браузере. Чтобы работать с нескольких устройств, подключите Supabase (см. README)."
              : `Вы вошли как ${session?.user.email}. Данные хранятся в Supabase и доступны с любого устройства.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={async () => (await confirm({ title: "Загрузить демо-данные?", text: "Текущие данные будут заменены демонстрационными (5 учеников, 2 месяца занятий).", ok: "Загрузить" })) && loadDemo()}>Загрузить демо-данные</Button>
            <Button variant="danger" onClick={async () => (await confirm({ title: "Удалить все данные?", text: "Все ученики, занятия, оплаты, оценки, темы и материалы будут удалены. Настройки сохранятся. Сначала сделайте экспорт!", ok: "Удалить всё" })) && replaceAll({ settings: [] } as unknown as DB)}>Очистить всё</Button>
          </div>
        </Card>
      </div>
    </>
  );
}
