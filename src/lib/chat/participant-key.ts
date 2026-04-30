/**
 * Canonical identifier for a 1:1 conversation between two users.
 * Sorting the participant ids guarantees uniqueness regardless of who
 * initiates the chat.
 */
export function buildParticipantKey(userIdA: string, userIdB: string) {
  if (!userIdA || !userIdB) {
    throw new Error("Participant ids must be non-empty");
  }
  if (userIdA === userIdB) {
    throw new Error("Cannot create a conversation with yourself");
  }
  const [a, b] = [userIdA, userIdB].sort();
  return `${a}__${b}`;
}
