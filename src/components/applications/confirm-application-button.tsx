"use client";

import { useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";

type ConfirmApplicationButtonProps = {
  applicationId: string;
};

export function ConfirmApplicationButton({ applicationId }: ConfirmApplicationButtonProps) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function handleConfirm() {
    setPending(true);

    try {
      const response = await fetch(`/api/applications/${applicationId}/confirm`, {
        method: "POST",
      });

      if (response.ok) {
        setDone(true);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending || done}
      onClick={handleConfirm}
      className="flex items-center justify-center gap-2 rounded-[20px] bg-[#e9f6ef] px-4 py-3 text-[14px] font-semibold text-[#42a16d] disabled:opacity-60"
    >
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle2 className="h-4 w-4" />
      )}
      {done ? "Подтверждён" : "Подтвердить"}
    </button>
  );
}
