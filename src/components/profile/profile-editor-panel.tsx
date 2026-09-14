"use client";

import { useState } from "react";

import { RegistrationForm } from "@/components/profile/registration-form";

export function ProfileEditorPanel() {
  const [open, setOpen] = useState(false);

  return (
    <section
      className="rounded-[32px] bg-[#eef3f7] p-4 text-[#101214] shadow-[0_12px_28px_rgba(20,27,33,0.08)]"
      style={{ fontFamily: '"Wix Madefor Display", var(--font-plex-sans), sans-serif' }}
    >
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <h2 className="text-[19px] font-semibold tracking-[-0.03em] text-[#101214]">
            Редактирование профиля
          </h2>
          <p className="mt-1 text-[14px] leading-6 text-[#6f7984]">
            Открывайте форму только когда нужно поменять имя, город, роль или фото.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="inline-flex h-10 w-full items-center justify-center rounded-full bg-[#3387d1] px-5 text-[14px] font-medium text-white"
        >
          {open ? "Скрыть" : "Редактировать"}
        </button>
      </div>

      {open ? (
        <div className="mt-4 rounded-[28px] bg-white p-1 shadow-[0_12px_28px_rgba(20,27,33,0.08)]">
          <RegistrationForm mode="profile" />
        </div>
      ) : null}
    </section>
  );
}
