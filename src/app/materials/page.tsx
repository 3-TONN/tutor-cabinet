"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Material } from "@/lib/types";
import { topicNames } from "@/lib/logic";
import { uid } from "@/lib/utils";
import { Badge, Button, Card, Empty, Field, IconButton, Input, Modal, MultiPick, PageHeader, SearchInput, Select, Textarea, useConfirm } from "@/components/ui";
import { Attachments, topicOptions } from "@/components/forms";

export default function MaterialsPage() {
  const { db, remove } = useStore();
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState("");
  const [modal, setModal] = useState<{ m?: Material } | null>(null);
  const list = db.materials
    .filter((m) => !q || `${m.title} ${m.description} ${topicNames(db, m.topic_ids).join(" ")}`.toLowerCase().includes(q.toLowerCase()))
    .filter((m) => !topic || m.topic_ids.includes(topic))
    .sort((a, b) => a.title.localeCompare(b.title));
  const usedTopics = [...new Set(db.materials.flatMap((m) => m.topic_ids))].filter((id) => db.topics.some((t) => t.id === id));

  return (
    <>
      <PageHeader title="Материалы" subtitle="Файлы и ссылки, привязанные к темам" actions={<Button icon="plus" onClick={() => setModal({})}>Материал</Button>} />
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <SearchInput value={q} onChange={setQ} placeholder="Название, тема…" />
        <Select value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="">Все темы</option>
          {usedTopics.map((id) => <option key={id} value={id}>{db.topics.find((t) => t.id === id)?.name}</option>)}
        </Select>
      </div>
      {list.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((m) => (
            <Card key={m.id}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{m.title}</div>
                  {m.description && <p className="text-sm text-graphite">{m.description}</p>}
                  <div className="mt-1 flex flex-wrap gap-1">{topicNames(db, m.topic_ids).map((t) => <Badge key={t} color="teal">{t}</Badge>)}</div>
                </div>
                <IconButton icon="edit" label="Изменить" onClick={() => setModal({ m })} />
                <IconButton icon="trash" label="Удалить" onClick={async () => (await confirm({ title: "Удалить материал?", text: m.title })) && remove("materials", m.id)} />
              </div>
              {m.attachments.length > 0 && <div className="mt-3"><Attachments value={m.attachments} readOnly /></div>}
            </Card>
          ))}
        </div>
      ) : <Empty icon="folder" title="Материалов нет" text="Добавьте файлы и ссылки, чтобы быстро находить их по темам." />}
      {modal && <MaterialModal m={modal.m} onClose={() => setModal(null)} />}
    </>
  );
}

function MaterialModal({ m, onClose }: { m?: Material; onClose: () => void }) {
  const { db, insert, update } = useStore();
  const [x, setX] = useState<Material>(m ?? { id: uid(), title: "", description: "", topic_ids: [], attachments: [] });
  const save = async () => {
    if (m) await update("materials", x.id, x);
    else await insert("materials", x);
    onClose();
  };
  return (
    <Modal open wide onClose={onClose} title={m ? "Материал" : "Новый материал"}
      footer={<><Button variant="secondary" onClick={onClose}>Отмена</Button><Button onClick={save} disabled={!x.title.trim()}>Сохранить</Button></>}>
      <div className="space-y-3">
        <Field label="Название"><Input value={x.title} onChange={(e) => setX({ ...x, title: e.target.value })} /></Field>
        <Field label="Описание"><Textarea value={x.description} onChange={(e) => setX({ ...x, description: e.target.value })} /></Field>
        <Field label="Темы"><MultiPick options={topicOptions(db)} value={x.topic_ids} onChange={(v) => setX({ ...x, topic_ids: v })} /></Field>
        <Field label="Файлы и ссылки"><Attachments value={x.attachments} onChange={(v) => setX({ ...x, attachments: v })} /></Field>
      </div>
    </Modal>
  );
}
