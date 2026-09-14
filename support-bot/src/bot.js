import pg from "pg";

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const adminChatId = process.env.SUPPORT_ADMIN_CHAT_ID?.trim() || "6344041488";
const databaseUrl = normalizeDatabaseUrl(process.env.DUBLER_DATABASE_URL?.trim());
const maxFileBytes = parsePositiveInt(process.env.SUPPORT_MAX_FILE_BYTES, 10 * 1024 * 1024);
const messageIntervalMs =
  parsePositiveInt(process.env.SUPPORT_MESSAGE_INTERVAL_SECONDS, 5) * 1000;

if (!token || token === "replace-with-support-bot-token") {
  console.error(
    "TELEGRAM_BOT_TOKEN is not configured. Create a bot in @BotFather and put its token into .env.",
  );
  process.exit(1);
}

if (!databaseUrl) {
  console.error("DUBLER_DATABASE_URL is not configured. Ticket mode requires Postgres.");
  process.exit(1);
}

const apiBase = `https://api.telegram.org/bot${token}`;
const db = new pg.Pool({ connectionString: databaseUrl });
const replyTargetsByAdminMessageId = new Map();
const lastUserMessageAt = new Map();
const pendingTicketChatIds = new Set();

let offset = 0;

const startMessage = [
  "Здравствуйте! Вы попали в техническую поддержку сервиса Дублер.",
  "",
  "Чтобы открыть заявку, пропишите /ticket и напишите ваше обращение.",
].join("\n");

const ticketPromptMessage = [
  "Опишите ваше обращение одним сообщением.",
  "",
  "Если есть скриншот или файл, отправьте его следующим сообщением после текста.",
].join("\n");

const ticketCreatedMessage = [
  "Спасибо за обращение! Ожидайте ответа тех. поддержки.",
  "",
  "Для закрытия заявки напишите /close",
].join("\n");

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function normalizeDatabaseUrl(value) {
  if (!value) {
    return "";
  }

  const url = new URL(value);
  url.searchParams.delete("schema");
  return url.toString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatBytes(value) {
  return `${Math.round(value / 1024 / 1024)} МБ`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
}

function truncate(value, maxLength = 700) {
  const text = String(value ?? "").trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}…`;
}

function getAttachmentSize(message) {
  const sizes = [
    ...(message.photo?.map((photo) => photo.file_size).filter(Boolean) ?? []),
    message.document?.file_size,
    message.video?.file_size,
    message.animation?.file_size,
    message.audio?.file_size,
    message.voice?.file_size,
    message.video_note?.file_size,
    message.sticker?.file_size,
  ].filter((value) => Number.isFinite(value));

  return sizes.length ? Math.max(...sizes) : 0;
}

function getMessageKind(message) {
  if (message.text) return "text";
  if (message.photo) return "photo";
  if (message.document) return "document";
  if (message.video) return "video";
  if (message.voice) return "voice";
  if (message.audio) return "audio";
  if (message.sticker) return "sticker";
  if (message.animation) return "animation";
  if (message.contact) return "contact";
  if (message.location) return "location";
  return "message";
}

function getMessageBody(message) {
  return message.text ?? message.caption ?? "";
}

function formatRoles(roles) {
  if (!roles) {
    return "нет";
  }

  if (Array.isArray(roles)) {
    return roles.length ? roles.join(", ") : "нет";
  }

  return String(roles).replace(/[{}"]/g, "").replaceAll(",", ", ") || "нет";
}

function formatDisplayName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Без имени";
}

function getSpamDelaySeconds(userId) {
  const lastSentAt = lastUserMessageAt.get(String(userId)) ?? 0;
  const elapsedMs = Date.now() - lastSentAt;

  if (elapsedMs >= messageIntervalMs) {
    return 0;
  }

  return Math.ceil((messageIntervalMs - elapsedMs) / 1000);
}

function markUserMessage(userId) {
  lastUserMessageAt.set(String(userId), Date.now());
}

async function telegram(method, payload) {
  const response = await fetch(`${apiBase}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    const description = data?.description || `HTTP ${response.status}`;
    throw new Error(`${method} failed: ${description}`);
  }

  return data.result;
}

async function initDb() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id BIGSERIAL PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'open',
      user_chat_id TEXT NOT NULL,
      user_telegram_id TEXT,
      username TEXT,
      display_name TEXT,
      dubler_user_id TEXT,
      subject TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      closed_at TIMESTAMPTZ
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS support_ticket_messages (
      id BIGSERIAL PRIMARY KEY,
      ticket_id BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      direction TEXT NOT NULL,
      telegram_message_id BIGINT,
      admin_message_id BIGINT,
      kind TEXT NOT NULL,
      body TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS support_tickets_user_open_idx
      ON support_tickets (user_chat_id, status, updated_at DESC)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS support_tickets_status_updated_idx
      ON support_tickets (status, updated_at DESC)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_idx
      ON support_ticket_messages (ticket_id, created_at DESC)
  `);
}

async function findDublerUser(telegramId) {
  if (!telegramId) {
    return { status: "disabled", user: null };
  }

  try {
    const result = await db.query(
      `
        SELECT
          u.id,
          u."telegramId",
          u.username,
          u."firstName",
          u."lastName",
          u."isBanned",
          c.name AS "cityName",
          COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
        FROM "User" u
        LEFT JOIN "City" c ON c.id = u."cityId"
        LEFT JOIN "UserRole" ur ON ur."userId" = u.id
        WHERE u."telegramId" = $1
        GROUP BY u.id, c.name
        LIMIT 1
      `,
      [String(telegramId)],
    );

    return { status: "ok", user: result.rows[0] ?? null };
  } catch (error) {
    console.error("Dubler DB lookup failed:", error instanceof Error ? error.message : error);
    return { status: "error", user: null };
  }
}

async function getOpenTicketByChatId(chatId) {
  const result = await db.query(
    `
      SELECT *
      FROM support_tickets
      WHERE user_chat_id = $1 AND status = 'open'
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [String(chatId)],
  );

  return result.rows[0] ?? null;
}

async function getTicket(ticketId) {
  const result = await db.query(
    "SELECT * FROM support_tickets WHERE id = $1 LIMIT 1",
    [String(ticketId)],
  );

  return result.rows[0] ?? null;
}

async function ensureOpenTicket(message) {
  const existing = await getOpenTicketByChatId(message.chat.id);
  if (existing) {
    return { ticket: existing, created: false };
  }

  const profile = await findDublerUser(message.from?.id);
  const dublerUser = profile.user;
  const body = truncate(getMessageBody(message), 120);
  const subject = body || `Вложение: ${getMessageKind(message)}`;
  const result = await db.query(
    `
      INSERT INTO support_tickets (
        user_chat_id,
        user_telegram_id,
        username,
        display_name,
        dubler_user_id,
        subject
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      String(message.chat.id),
      message.from?.id ? String(message.from.id) : null,
      message.from?.username ?? null,
      formatDisplayName(message.from),
      dublerUser?.id ?? null,
      subject,
    ],
  );

  return { ticket: result.rows[0], created: true };
}

async function addTicketMessage({ ticketId, direction, message, adminMessageId = null, body = null }) {
  const kind = message ? getMessageKind(message) : "text";
  const text = body ?? (message ? getMessageBody(message) : "");

  await db.query(
    `
      INSERT INTO support_ticket_messages (
        ticket_id,
        direction,
        telegram_message_id,
        admin_message_id,
        kind,
        body
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      ticketId,
      direction,
      message?.message_id ?? null,
      adminMessageId,
      kind,
      truncate(text, 4000),
    ],
  );

  await db.query("UPDATE support_tickets SET updated_at = now() WHERE id = $1", [ticketId]);
}

async function closeTicket(ticketId) {
  const result = await db.query(
    `
      UPDATE support_tickets
      SET status = 'closed', closed_at = now(), updated_at = now()
      WHERE id = $1 AND status <> 'closed'
      RETURNING *
    `,
    [String(ticketId)],
  );

  return result.rows[0] ?? null;
}

async function reopenTicket(ticketId) {
  const result = await db.query(
    `
      UPDATE support_tickets
      SET status = 'open', closed_at = NULL, updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [String(ticketId)],
  );

  return result.rows[0] ?? null;
}

async function listOpenTickets(limit = 10) {
  const result = await db.query(
    `
      SELECT
        t.*,
        (
          SELECT m.body
          FROM support_ticket_messages m
          WHERE m.ticket_id = t.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) AS last_body
      FROM support_tickets t
      WHERE t.status = 'open'
      ORDER BY t.updated_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows;
}

async function listTicketMessages(ticketId, limit = 8) {
  const result = await db.query(
    `
      SELECT *
      FROM support_ticket_messages
      WHERE ticket_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [String(ticketId), limit],
  );

  return result.rows.reverse();
}

function formatDublerProfile(ticket) {
  const lines = [];
  if (ticket.dubler_user_id) {
    lines.push(`<b>Профиль Дублера:</b> найден`);
    lines.push(`<b>User DB ID:</b> <code>${escapeHtml(ticket.dubler_user_id)}</code>`);
  } else {
    lines.push("<b>Профиль Дублера:</b> не найден");
  }

  return lines.join("\n");
}

function formatTicketCard(ticket, message, created) {
  const username = ticket.username ? `@${ticket.username}` : "нет";
  const body = truncate(getMessageBody(message), 1000);

  return [
    created ? "<b>Новый тикет поддержки</b>" : "<b>Новое сообщение в тикете</b>",
    "",
    `<b>Тикет:</b> #${ticket.id}`,
    `<b>Статус:</b> ${ticket.status}`,
    `<b>Имя:</b> ${escapeHtml(ticket.display_name)}`,
    `<b>Username:</b> ${escapeHtml(username)}`,
    `<b>Telegram ID:</b> <code>${escapeHtml(ticket.user_telegram_id ?? "unknown")}</code>`,
    formatDublerProfile(ticket),
    "",
    `<b>Тип:</b> ${escapeHtml(getMessageKind(message))}`,
    body ? `<b>Сообщение:</b>\n${escapeHtml(body)}` : "<b>Сообщение:</b> вложение без текста",
    "",
    `<code>/reply ${ticket.id} текст ответа</code>`,
    `<code>/close ${ticket.id}</code>`,
  ].join("\n");
}

function formatTicketDetails(ticket, messages) {
  const username = ticket.username ? `@${ticket.username}` : "нет";
  const history = messages.length
    ? messages
        .map((message) => {
          const author = message.direction === "admin" ? "Поддержка" : "Клиент";
          const body = message.body ? truncate(message.body, 250) : `[${message.kind}]`;
          return `${formatDate(message.created_at)} ${author}: ${body}`;
        })
        .join("\n")
    : "История пока пустая.";

  return [
    `<b>Тикет #${ticket.id}</b>`,
    `<b>Статус:</b> ${escapeHtml(ticket.status)}`,
    `<b>Клиент:</b> ${escapeHtml(ticket.display_name)} (${escapeHtml(username)})`,
    `<b>Telegram ID:</b> <code>${escapeHtml(ticket.user_telegram_id ?? "unknown")}</code>`,
    `<b>Тема:</b> ${escapeHtml(ticket.subject ?? "без темы")}`,
    `<b>Создан:</b> ${formatDate(ticket.created_at)}`,
    "",
    "<b>Последние сообщения:</b>",
    escapeHtml(history),
    "",
    `<code>/reply ${ticket.id} текст ответа</code>`,
    ticket.status === "closed" ? `<code>/open ${ticket.id}</code>` : `<code>/close ${ticket.id}</code>`,
  ].join("\n");
}

function parseCommand(text) {
  const [commandWithBot, ...rest] = text.trim().split(/\s+/);
  const command = commandWithBot.split("@")[0].toLowerCase();
  return {
    command,
    args: rest,
    rest: text.trim().slice(commandWithBot.length).trim(),
  };
}

function getOriginalTicketIdFromAdminReply(message) {
  const replyToId = message.reply_to_message?.message_id;
  if (!replyToId) {
    return null;
  }

  return replyTargetsByAdminMessageId.get(replyToId) ?? null;
}

async function sendStart(chatId) {
  await telegram("sendMessage", {
    chat_id: chatId,
    text: startMessage,
  });
}

async function notifyAdmin(ticket, message, created) {
  const notice = await telegram("sendMessage", {
    chat_id: adminChatId,
    text: formatTicketCard(ticket, message, created),
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });

  replyTargetsByAdminMessageId.set(notice.message_id, ticket.id);

  if (!message.text) {
    const copied = await telegram("copyMessage", {
      chat_id: adminChatId,
      from_chat_id: message.chat.id,
      message_id: message.message_id,
    });

    replyTargetsByAdminMessageId.set(copied.message_id, ticket.id);
  }
}

async function sendReplyToUser(ticket, text, adminMessage = null) {
  await telegram("sendMessage", {
    chat_id: ticket.user_chat_id,
    text: `Поддержка Дублера по тикету #${ticket.id}:\n\n${text}`,
  });

  await addTicketMessage({
    ticketId: ticket.id,
    direction: "admin",
    message: adminMessage,
    body: text,
  });
}

async function handleAdminCommand(message) {
  const text = message.text?.trim() ?? "";
  const { command, args, rest } = parseCommand(text);

  if (command === "/start" || command === "/help") {
    await telegram("sendMessage", {
      chat_id: adminChatId,
      text: [
        "Команды поддержки:",
        "/tickets - открытые тикеты",
        "/ticket 123 - детали тикета",
        "/reply 123 текст - ответить клиенту",
        "/close 123 - закрыть тикет",
        "/open 123 - открыть тикет снова",
        "",
        "Можно также ответить реплаем на карточку тикета.",
      ].join("\n"),
    });
    return true;
  }

  if (command === "/tickets") {
    const tickets = await listOpenTickets();
    const textToSend = tickets.length
      ? tickets
          .map((ticket) => {
            const username = ticket.username ? `@${ticket.username}` : "без username";
            const last = ticket.last_body ? `\n${truncate(ticket.last_body, 120)}` : "";
            return `#${ticket.id} ${ticket.display_name} (${username})${last}`;
          })
          .join("\n\n")
      : "Открытых тикетов нет.";

    await telegram("sendMessage", { chat_id: adminChatId, text: textToSend });
    return true;
  }

  if (command === "/ticket") {
    const ticketId = args[0];
    const ticket = ticketId ? await getTicket(ticketId) : null;
    if (!ticket) {
      await telegram("sendMessage", { chat_id: adminChatId, text: "Тикет не найден." });
      return true;
    }

    const messages = await listTicketMessages(ticket.id);
    await telegram("sendMessage", {
      chat_id: adminChatId,
      text: formatTicketDetails(ticket, messages),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    return true;
  }

  if (command === "/reply") {
    const ticketId = args[0];
    const replyText = rest.replace(/^\S+\s*/, "").trim();
    const ticket = ticketId ? await getTicket(ticketId) : null;

    if (!ticket || !replyText) {
      await telegram("sendMessage", {
        chat_id: adminChatId,
        text: "Формат: /reply 123 текст ответа",
      });
      return true;
    }

    if (ticket.status === "closed") {
      await reopenTicket(ticket.id);
    }

    await sendReplyToUser(ticket, replyText, message);
    await telegram("sendMessage", {
      chat_id: adminChatId,
      text: `Ответ отправлен в тикет #${ticket.id}.`,
    });
    return true;
  }

  if (command === "/close") {
    const ticketId = args[0];
    const ticket = ticketId ? await closeTicket(ticketId) : null;
    if (!ticket) {
      await telegram("sendMessage", {
        chat_id: adminChatId,
        text: "Тикет не найден или уже закрыт.",
      });
      return true;
    }

    await telegram("sendMessage", {
      chat_id: ticket.user_chat_id,
      text: `Тикет #${ticket.id} закрыт. Если вопрос вернется, просто напишите сюда снова.`,
    });
    await telegram("sendMessage", {
      chat_id: adminChatId,
      text: `Тикет #${ticket.id} закрыт.`,
    });
    return true;
  }

  if (command === "/open") {
    const ticketId = args[0];
    const ticket = ticketId ? await reopenTicket(ticketId) : null;
    if (!ticket) {
      await telegram("sendMessage", { chat_id: adminChatId, text: "Тикет не найден." });
      return true;
    }

    await telegram("sendMessage", {
      chat_id: adminChatId,
      text: `Тикет #${ticket.id} снова открыт.`,
    });
    return true;
  }

  return false;
}

async function handleAdminMessage(message) {
  if (message.text?.startsWith("/")) {
    const handled = await handleAdminCommand(message);
    if (handled) {
      return;
    }
  }

  const ticketId = getOriginalTicketIdFromAdminReply(message);
  const replyText = getMessageBody(message);

  if (!ticketId) {
    await telegram("sendMessage", {
      chat_id: adminChatId,
      text: "Ответьте реплаем на карточку тикета или используйте /reply 123 текст.",
    });
    return;
  }

  const ticket = await getTicket(ticketId);
  if (!ticket) {
    await telegram("sendMessage", { chat_id: adminChatId, text: "Тикет не найден." });
    return;
  }

  if (!replyText && message.text) {
    await telegram("sendMessage", { chat_id: adminChatId, text: "Пустой ответ не отправлен." });
    return;
  }

  if (ticket.status === "closed") {
    await reopenTicket(ticket.id);
  }

  if (message.text) {
    await sendReplyToUser(ticket, replyText, message);
  } else {
    await telegram("copyMessage", {
      chat_id: ticket.user_chat_id,
      from_chat_id: message.chat.id,
      message_id: message.message_id,
    });
    await addTicketMessage({
      ticketId: ticket.id,
      direction: "admin",
      message,
      body: getMessageBody(message) || `[${getMessageKind(message)}]`,
    });
  }

  await telegram("sendMessage", {
    chat_id: adminChatId,
    text: `Ответ отправлен в тикет #${ticket.id}.`,
  });
}

async function handleUserCommand(message) {
  const text = message.text?.trim() ?? "";
  const { command } = parseCommand(text);

  if (command === "/start" || command === "/help") {
    await sendStart(message.chat.id);
    return true;
  }

  if (command === "/ticket") {
    const ticket = await getOpenTicketByChatId(message.chat.id);
    if (ticket) {
      await telegram("sendMessage", {
        chat_id: message.chat.id,
        text: `У вас уже открыта заявка #${ticket.id}. Напишите сообщение, и я добавлю его к заявке.\n\nДля закрытия заявки напишите /close`,
      });
      return true;
    }

    pendingTicketChatIds.add(String(message.chat.id));
    await telegram("sendMessage", {
      chat_id: message.chat.id,
      text: ticketPromptMessage,
    });
    return true;
  }

  if (command === "/close") {
    const ticket = await getOpenTicketByChatId(message.chat.id);
    if (!ticket) {
      await telegram("sendMessage", {
        chat_id: message.chat.id,
        text: "Открытого тикета нет.",
      });
      return true;
    }

    await closeTicket(ticket.id);
    pendingTicketChatIds.delete(String(message.chat.id));
    await telegram("sendMessage", {
      chat_id: message.chat.id,
      text: `Тикет #${ticket.id} закрыт. Если понадобится помощь, просто напишите снова.`,
    });
    await telegram("sendMessage", {
      chat_id: adminChatId,
      text: `Клиент закрыл тикет #${ticket.id}.`,
    });
    return true;
  }

  return false;
}

async function handleUserMessage(message) {
  if (message.text?.startsWith("/")) {
    const handled = await handleUserCommand(message);
    if (handled) {
      return;
    }
  }

  const openTicket = await getOpenTicketByChatId(message.chat.id);
  const isPendingTicket = pendingTicketChatIds.has(String(message.chat.id));

  if (!openTicket && !isPendingTicket) {
    await sendStart(message.chat.id);
    return;
  }

  const delaySeconds = getSpamDelaySeconds(message.from?.id ?? message.chat.id);
  if (delaySeconds > 0) {
    await telegram("sendMessage", {
      chat_id: message.chat.id,
      text: `Пожалуйста, подождите ${delaySeconds} сек. перед следующим сообщением. Это помогает защитить поддержку от спама.`,
    });
    return;
  }
  markUserMessage(message.from?.id ?? message.chat.id);

  const attachmentSize = getAttachmentSize(message);
  if (attachmentSize > maxFileBytes) {
    await telegram("sendMessage", {
      chat_id: message.chat.id,
      text: `Файл слишком большой. Максимальный размер вложения - ${formatBytes(maxFileBytes)}. Пожалуйста, сожмите файл или отправьте скриншот меньшего размера.`,
    });
    return;
  }

  const { ticket, created } = openTicket
    ? { ticket: openTicket, created: false }
    : await ensureOpenTicket(message);
  await addTicketMessage({ ticketId: ticket.id, direction: "user", message });
  await notifyAdmin(ticket, message, created);

  if (created) {
    pendingTicketChatIds.delete(String(message.chat.id));
    await telegram("sendMessage", {
      chat_id: message.chat.id,
      text: ticketCreatedMessage,
    });
  }
}

async function handleMessage(message) {
  if (String(message.chat.id) === adminChatId) {
    await handleAdminMessage(message);
    return;
  }

  await handleUserMessage(message);
}

async function poll() {
  while (true) {
    try {
      const updates = await telegram("getUpdates", {
        offset,
        timeout: 30,
        allowed_updates: ["message"],
      });

      for (const update of updates) {
        offset = update.update_id + 1;
        if (update.message) {
          await handleMessage(update.message);
        }
      }
    } catch (error) {
      console.error(new Date().toISOString(), error instanceof Error ? error.message : error);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

console.info("Doobler ticket support bot starting.");
console.info(`Admin chat: ${adminChatId}.`);
console.info(`Max file size: ${formatBytes(maxFileBytes)}.`);
console.info(`Message interval: ${Math.round(messageIntervalMs / 1000)} sec.`);
await initDb();
console.info("Ticket tables are ready.");
await telegram("deleteWebhook", { drop_pending_updates: false });
console.info("Doobler ticket support bot started.");
await poll();
