import { AlertTriangle, ShieldAlert, ShieldCheck, Siren } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { REPORT_REASONS } from "@/lib/constants";

export default function ModerationPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Жалобы и модерация"
        subtitle="В MVP нет публичных чёрных списков: все риски уходят во внутреннюю модерацию."
      />

      <section className="rounded-[30px] bg-white p-5 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
        <div className="mb-4 flex items-center gap-3">
          <span className="rounded-2xl bg-[#fff4e8] p-3 text-[#df6d64]">
            <Siren className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[20px] font-semibold tracking-[-0.03em] text-[#101214]">
              Подать жалобу
            </h2>
            <p className="text-[14px] text-[#7f8791]">
              Модератор видит risk flags, историю жалоб и статус проверки.
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          {REPORT_REASONS.map((reason) => (
            <div
              key={reason}
              className="flex items-center justify-between rounded-[22px] bg-[#f8fbfd] px-4 py-4"
            >
              <span className="text-[14px] font-medium text-[#101214]">{reason}</span>
              <AlertTriangle className="h-4 w-4 text-[#a6abb2]" />
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-[26px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
          <ShieldAlert className="h-5 w-5 text-[#df6d64]" />
          <p className="mt-3 text-[16px] font-semibold text-[#101214]">Risk flags</p>
          <p className="mt-2 text-[14px] text-[#7f8791]">
            Флаги для фейковых объявлений, спама и неявок.
          </p>
        </div>
        <div className="rounded-[26px] bg-white p-4 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
          <ShieldCheck className="h-5 w-5 text-[#42a16d]" />
          <p className="mt-3 text-[16px] font-semibold text-[#101214]">Верификация</p>
          <p className="mt-2 text-[14px] text-[#7f8791]">
            Ручная проверка профиля работника и ПВЗ работодателя.
          </p>
        </div>
      </section>
    </div>
  );
}
