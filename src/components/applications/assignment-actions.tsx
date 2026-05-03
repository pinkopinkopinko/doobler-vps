"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, MessageSquarePlus, ShieldCheck } from "lucide-react";

import { fetchWithTelegramAuth } from "@/lib/auth/client";
import type { AssignmentStatus } from "@/lib/types";

type AssignmentActionsProps = {
  assignmentId: string;
  assignmentStatus: AssignmentStatus;
  reviewSubmitted: boolean;
  canComplete?: boolean;
  reviewTargetLabel?: string;
  reviewPlaceholder?: string;
};

type FeedbackState =
  | { tone: "success"; text: string }
  | { tone: "error"; text: string }
  | null;

export function AssignmentActions({
  assignmentId,
  assignmentStatus,
  reviewSubmitted: initialReviewSubmitted,
  canComplete = true,
  reviewTargetLabel = "сотрудника",
  reviewPlaceholder = "Как человек отработал смену?",
}: AssignmentActionsProps) {
  const [status, setStatus] = useState<AssignmentStatus>(assignmentStatus);
  const [reviewSubmitted, setReviewSubmitted] = useState(initialReviewSubmitted);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [rating, setRating] = useState("5");
  const [text, setText] = useState("");
  const [pendingAction, setPendingAction] = useState<"complete" | "review" | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  async function handleComplete() {
    setPendingAction("complete");
    setFeedback(null);

    try {
      const response = await fetchWithTelegramAuth(`/api/assignments/${assignmentId}/complete`, {
        method: "POST",
      });

      if (!response.ok) {
        setFeedback({ tone: "error", text: "Не удалось закрыть смену." });
        return;
      }

      setStatus("COMPLETED");
      setFeedback({ tone: "success", text: "Смена закрыта. Теперь можно оставить отзыв." });
    } catch {
      setFeedback({ tone: "error", text: "Не удалось закрыть смену." });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleReviewSubmit() {
    setPendingAction("review");
    setFeedback(null);

    try {
      const response = await fetchWithTelegramAuth(`/api/assignments/${assignmentId}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rating: Number(rating),
          text: text.trim(),
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setFeedback({ tone: "error", text: payload?.error ?? "Не удалось сохранить отзыв." });
        return;
      }

      setReviewSubmitted(true);
      setShowReviewForm(false);
      setText("");
      setFeedback({ tone: "success", text: "Отзыв сохранён." });
    } catch {
      setFeedback({ tone: "error", text: "Не удалось сохранить отзыв." });
    } finally {
      setPendingAction(null);
    }
  }

  const feedbackNode = feedback ? (
    <p
      className={`flex items-start gap-2 rounded-[16px] border px-3 py-2 text-[13px] ${
        feedback.tone === "success"
          ? "border-emerald-100 bg-emerald-50 text-emerald-700"
          : "border-rose-100 bg-rose-50 text-rose-700"
      }`}
    >
      {feedback.tone === "success" ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span>{feedback.text}</span>
    </p>
  ) : null;

  if (status !== "COMPLETED" && canComplete) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={handleComplete}
          disabled={pendingAction !== null}
          className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-[#3387d1] px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-60"
        >
          {pendingAction === "complete" ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          Закрыть смену
        </button>
        {feedbackNode}
      </div>
    );
  }

  if (status !== "COMPLETED") {
    return (
      <div className="rounded-[20px] bg-[#f2f5f8] px-4 py-3 text-[14px] text-[#667381]">
        Отзыв можно оставить после завершения смены.
      </div>
    );
  }

  if (reviewSubmitted) {
    return (
      <div className="space-y-3">
        <div className="rounded-[20px] bg-[#f2f5f8] px-4 py-3 text-[14px] text-[#7f8791]">
          Отзыв по этой смене уже оставлен.
        </div>
        {feedbackNode}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!showReviewForm ? (
        <button
          type="button"
          onClick={() => setShowReviewForm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-[#e9f6ef] px-4 py-3 text-[14px] font-semibold text-[#42a16d]"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Оставить отзыв о {reviewTargetLabel}
        </button>
      ) : (
        <div className="space-y-3 rounded-[22px] bg-[#f8fbfd] p-4">
          <label className="grid gap-2 text-[14px]">
            <span className="font-medium text-[#101214]">Оценка</span>
            <select
              value={rating}
              onChange={(event) => setRating(event.target.value)}
              className="rounded-[16px] border border-[#e1e6eb] bg-white px-3 py-3 text-[#101214]"
            >
              <option value="5">5</option>
              <option value="4">4</option>
              <option value="3">3</option>
              <option value="2">2</option>
              <option value="1">1</option>
            </select>
          </label>

          <label className="grid gap-2 text-[14px]">
            <span className="font-medium text-[#101214]">Комментарий</span>
            <textarea
              rows={3}
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="rounded-[16px] border border-[#e1e6eb] bg-white px-3 py-3 text-[#101214]"
              placeholder={reviewPlaceholder}
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReviewSubmit}
              disabled={pendingAction !== null || text.trim().length < 4}
              className="flex-1 rounded-[16px] bg-[#3387d1] px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-60"
            >
              {pendingAction === "review" ? "Сохраняем..." : "Сохранить отзыв"}
            </button>
            <button
              type="button"
              onClick={() => setShowReviewForm(false)}
              disabled={pendingAction !== null}
              className="rounded-[16px] bg-[#eef3f7] px-4 py-3 text-[14px] font-medium text-[#101214]"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {feedbackNode}
    </div>
  );
}
