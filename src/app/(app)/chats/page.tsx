import { PageHeader } from "@/components/layout/page-header";
import { ChatsIndex } from "@/components/chat/chats-index";

export const dynamic = "force-dynamic";

export default function ChatsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Сообщения"
        subtitle="Чаты с работодателями и кандидатами. Фотографии можно прикреплять к сообщениям."
      />
      <ChatsIndex />
    </div>
  );
}
