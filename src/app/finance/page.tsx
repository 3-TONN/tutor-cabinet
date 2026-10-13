"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Payment } from "@/lib/types";
import { PAYMENT_KIND, PAYMENT_METHOD, allLedgers, earnedByMonth, expectedForMonth, paidByMonth, paymentAlerts } from "@/lib/logic";
import { addMonths, downloadFile, fmtDate, monthKey, monthLabel, rub, sum, toCsv, todayYmd, ymd, MONTHS } from "@/lib/utils";
import { Badge, Button, Card, Empty, Field, Input, PageHeader, Stat, Table, Tabs } from "@/components/ui";
import { PaymentModal, StudentSelect } from "@/components/forms";
import { BarChart } from "@/components/Charts";

type Tab = "balances" | "payments" | "reports";

export default function FinancePage() {
  const { db, settings } = useStore();
  const [tab, setTab] = useState<Tab>("balances");
  const [modal, setModal] = useState<{ p?: Payment; studentId?: string } | null>(null);
  const ledgers = useMemo(() => allLedgers(db, settings), [db, settings]);
  const alerts = useMemo(() => paymentAlerts(db, settings), [db, settings]);
  const now = new Date();
  const thisKey = monthKey(ymd(now));
  const paid = paidByMonth(db);
  const earned = useMemo(() => earnedByMonth(db, settings), [db, settings]);
  const totalDebt = -sum([...ledgers.values()].map((l) => Math.min(0, l.balance)));
  const totalPrepaid = sum([...ledgers.values()].map((l) => Math.max(0, l.balance)));

  // фильтры списка оплат и экспорта
  const [from, setFrom] = useState(ymd(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(todayYmd());
  const [sid, setSid] = useState("");
  const payments = db.payments.filter((p) => p.date >= from && p.date <= to && (!sid || p.student_id === sid)).sort((a, b) => b.date.localeCompare(a.date));
  const name = (id: string) => db.students.find((s) => s.id === id)?.full_name ?? "—";

  const exportPayments = () => {
    const rows: (string | number)[][] = [["Дата", "Ученик", "Сумма, ₽", "Способ", "Назначение", "Комментарий"]];
    [...payments].reverse().forEach((p) => rows.push([fmtDate(p.date), name(p.student_id), p.amount, PAYMENT_METHOD[p.method], PAYMENT_KIND[p.kind], p.comment]));
    rows.push([], ["Итого", "", sum(payments.map((p) => p.amount))]);
    downloadFile(`оплаты_${from}_${to}.csv`, toCsv(rows), "text/csv;charset=utf-8");
  };

  // отчёты по месяцам — последние 12
  const months = Array.from({ length: 12 }, (_, i) => monthKey(ymd(addMonths(now, i - 11))));
  const exportMonths = () => {
    const rows: (string | number)[][] = [["Месяц", "Получено, ₽", "Заработано (проведено), ₽", "Запланировано, ₽"]];
    months.forEach((m) => rows.push([monthLabel(m), paid.get(m) ?? 0, Math.round(earned.get(m) ?? 0), expectedForMonth(db, m)]));
    downloadFile(`доход_по_месяцам.csv`, toCsv(rows), "text/csv;charset=utf-8");
  };
  const byStudent = db.students.map((s) => {
    const p = db.payments.filter((x) => x.student_id === s.id && x.date >= from && x.date <= to);
    const lessons = db.lessons.filter((l) => l.student_id === s.id && ymd(new Date(l.starts_at)) >= from && ymd(new Date(l.starts_at)) <= to);
    const lg = ledgers.get(s.id)!;
    return { s, paid: sum(p.map((x) => x.amount)), earned: sum(lessons.map((l) => lg.charges.get(l.id)?.amount ?? 0)), planned: sum(lessons.filter((l) => l.status === "planned").map((l) => l.price)) };
  }).filter((r) => r.paid || r.earned || r.planned).sort((a, b) => b.paid - a.paid);

  return (
    <>
      <PageHeader title="Оплаты и финансы" actions={<Button icon="plus" onClick={() => setModal({})}>Внести оплату</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Получено за ${MONTHS[now.getMonth()].toLowerCase()}`} value={rub(paid.get(thisKey) ?? 0)} sub={`Прошлый месяц: ${rub(paid.get(monthKey(ymd(addMonths(now, -1)))) ?? 0)}`} />
        <Stat label="Ожидается до конца месяца" value={rub(expectedForMonth(db, thisKey))} sub="По запланированным занятиям" />
        <Stat label="Долги учеников" value={rub(totalDebt)} tone={totalDebt > 0 ? "bad" : undefined} sub={`${alerts.filter((a) => a.kind === "debt").length} учен.`} />
        <Stat label="Предоплаты на балансах" value={rub(totalPrepaid)} />
      </div>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: "balances", label: "Балансы" }, { id: "payments", label: "Оплаты" }, { id: "reports", label: "Отчёты и экспорт" }]} />
      <div className="mt-4">
        {tab === "balances" && (
          <div className="space-y-4">
            {alerts.length > 0 && (
              <Card title="Напоминания об оплате">
                <ul className="space-y-2">
                  {alerts.map((a) => (
                    <li key={a.student.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge color={a.kind === "debt" ? "red" : "amber"}>{a.kind === "debt" ? `Долг ${rub(-a.balance)}` : "1 занятие в абонементе"}</Badge>
                      <Link href={`/students/view?id=${a.student.id}&tab=payments`} className="font-medium hover:underline">{a.student.full_name}</Link>
                      <Button size="sm" variant="secondary" className="ml-auto" icon="copy" onClick={() => {
                        const txt = a.kind === "debt"
                          ? `Здравствуйте! Напоминаю об оплате занятий: задолженность составляет ${rub(-a.balance)}. Спасибо!`
                          : `Здравствуйте! В абонементе осталось одно занятие. Чтобы не прерывать занятия, можно оплатить следующий абонемент. Спасибо!`;
                        navigator.clipboard.writeText(txt);
                      }}>Текст напоминания</Button>
                      <Button size="sm" onClick={() => setModal({ studentId: a.student.id })}>Оплата</Button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <Card padded={false}>
              <Table head={["Ученик", "Баланс", "Абонемент", "Оплачено", "Списано", ""]}>
                {db.students.filter((s) => s.status !== "finished" || (ledgers.get(s.id)?.balance ?? 0) !== 0).map((s) => {
                  const lg = ledgers.get(s.id)!;
                  return (
                    <tr key={s.id}>
                      <td className="px-3 py-2"><Link href={`/students/view?id=${s.id}&tab=payments`} className="font-medium hover:underline">{s.full_name}</Link></td>
                      <td className={`px-3 py-2 whitespace-nowrap font-semibold tabular-nums ${lg.balance < 0 ? "text-signal" : ""}`}>{rub(lg.balance)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{lg.activeSub ? `${lg.activeSub.left} из ${lg.activeSub.sub.lessons_total} до ${fmtDate(lg.activeSub.sub.expires_at)}` : "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">{rub(lg.paid)}</td>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">{rub(lg.charged)}</td>
                      <td className="px-3 py-2"><Button size="sm" variant="secondary" onClick={() => setModal({ studentId: s.id })}>+ оплата</Button></td>
                    </tr>
                  );
                })}
              </Table>
            </Card>
          </div>
        )}

        {(tab === "payments" || tab === "reports") && (
          <div className="mb-4 grid gap-2 sm:grid-cols-4">
            <Field label="С"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="По"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            {tab === "payments" && <Field label="Ученик"><StudentSelect value={sid} onChange={setSid} allowEmpty="Все ученики" includeInactive /></Field>}
            <div className="flex items-end gap-2">
              {tab === "payments" && <Button variant="secondary" icon="download" onClick={exportPayments}>CSV / Excel</Button>}
            </div>
          </div>
        )}

        {tab === "payments" && (
          payments.length ? (
            <Card padded={false} title={<span>Итого за период: {rub(sum(payments.map((p) => p.amount)))}</span>}>
              <Table head={["Дата", "Ученик", "Сумма", "За что", "Способ", "Комментарий"]}>
                {payments.map((p) => (
                  <tr key={p.id} className="cursor-pointer hover:bg-mist" onClick={() => setModal({ p })}>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(p.date)}</td>
                    <td className="px-3 py-2">{name(p.student_id)}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium tabular-nums">{rub(p.amount)}</td>
                    <td className="px-3 py-2">{PAYMENT_KIND[p.kind]}</td>
                    <td className="px-3 py-2">{PAYMENT_METHOD[p.method]}</td>
                    <td className="px-3 py-2 text-graphite">{p.comment}</td>
                  </tr>
                ))}
              </Table>
            </Card>
          ) : <Empty icon="wallet" title="За выбранный период оплат нет" />
        )}

        {tab === "reports" && (
          <div className="space-y-4">
            <Card title="Доход по месяцам" actions={<Button size="sm" variant="secondary" icon="download" onClick={exportMonths}>CSV</Button>}>
              <BarChart bars={months.map((m) => ({ label: MONTHS[Number(m.slice(5)) - 1].slice(0, 3), value: paid.get(m) ?? 0, value2: earned.get(m) ?? 0 }))} format={(v) => rub(v)} />
              <div className="mt-2 flex gap-4 text-xs text-graphite">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-ink" />Получено (оплаты)</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-ink/25" />Заработано (проведённые занятия)</span>
              </div>
              <p className="mt-2 text-xs text-graphite">Для налога самозанятого учитываются поступившие оплаты — используйте экспорт оплат за период.</p>
            </Card>
            <Card title={`По ученикам: ${fmtDate(from)} – ${fmtDate(to)}`} padded={false}>
              {byStudent.length ? (
                <Table head={["Ученик", "Получено", "Заработано", "Запланировано"]}>
                  {byStudent.map((r) => (
                    <tr key={r.s.id}>
                      <td className="px-3 py-2">{r.s.full_name}</td>
                      <td className="px-3 py-2 tabular-nums">{rub(r.paid)}</td>
                      <td className="px-3 py-2 tabular-nums">{rub(r.earned)}</td>
                      <td className="px-3 py-2 tabular-nums">{rub(r.planned)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="px-3 py-2">Итого</td>
                    <td className="px-3 py-2 tabular-nums">{rub(sum(byStudent.map((r) => r.paid)))}</td>
                    <td className="px-3 py-2 tabular-nums">{rub(sum(byStudent.map((r) => r.earned)))}</td>
                    <td className="px-3 py-2 tabular-nums">{rub(sum(byStudent.map((r) => r.planned)))}</td>
                  </tr>
                </Table>
              ) : <Empty icon="chart" title="Нет данных за период" />}
            </Card>
          </div>
        )}
      </div>
      {modal && <PaymentModal open payment={modal.p} studentId={modal.studentId} onClose={() => setModal(null)} />}
    </>
  );
}
