"use client";

// В демо-режиме — выбор ученика для просмотра кабинета «глазами ученика».
// Если ученик выбран, AppShell сам показывает PortalView вместо этой страницы.

import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Avatar, Card, PageHeader } from "@/components/ui";

export default function PortalPicker() {
  const { db, setPortalStudentId } = useStore();
  const router = useRouter();
  return (
    <>
      <PageHeader title="Личный кабинет ученика" subtitle="Выберите ученика, чтобы увидеть кабинет его глазами (только просмотр)" />
      <Card padded={false}>
        <ul className="divide-y divide-line">
          {db.students.map((s) => (
            <li key={s.id}>
              <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-mist"
                onClick={() => { setPortalStudentId(s.id); router.refresh(); }}>
                <Avatar name={s.full_name} color={s.color} />
                <span className="flex-1">{s.full_name}</span>
                <span className="text-xs text-graphite">{s.portal_emails.join(", ") || "e-mail для входа не указан"}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
