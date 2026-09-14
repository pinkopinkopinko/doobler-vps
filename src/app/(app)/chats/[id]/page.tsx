import { notFound } from "next/navigation";

import { getCurrentUserRecord } from "@/lib/auth/app-access";
import { getConversationForUser } from "@/server/services/chat-service";
import { ChatConversation } from "@/components/chat/chat-conversation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ChatDetailPage({ params }: Props) {
  const { id } = await params;
  // Используем тот же cached fetch, что и (app)/layout.tsx → getAppAccessState,
  // чтобы не делать второй SELECT на User при каждом заходе в чат.
  const record = await getCurrentUserRecord();

  if (!record) {
    notFound();
  }

  const conversation = await getConversationForUser({
    conversationId: id,
    currentUserId: record.user.id,
  }).catch(() => null);

  if (!conversation) {
    notFound();
  }

  return (
    <ChatConversation
      conversationId={conversation.id}
      currentUserId={record.user.id}
      peer={conversation.peer}
      activeShift={conversation.activeShift}
    />
  );
}
