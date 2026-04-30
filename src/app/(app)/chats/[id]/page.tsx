import { notFound } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getConversationForUser } from "@/server/services/chat-service";
import { ChatConversation } from "@/components/chat/chat-conversation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ChatDetailPage({ params }: Props) {
  const { id } = await params;
  const current = await getCurrentUser();

  if (!current) {
    notFound();
  }

  const conversation = await getConversationForUser({
    conversationId: id,
    currentUserId: current.id,
  }).catch(() => null);

  if (!conversation) {
    notFound();
  }

  return (
    <ChatConversation
      conversationId={conversation.id}
      currentUserId={current.id}
      peer={conversation.peer}
    />
  );
}
