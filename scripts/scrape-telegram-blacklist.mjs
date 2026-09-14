import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const CHANNEL = "Blacklist_pvz";
const BASE_URL = `https://t.me/s/${CHANNEL}`;
const POST_URL = `https://t.me/${CHANNEL}`;
const OUT_DIR = path.resolve("data", "blacklist-pvz");
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function htmlToText(html) {
  return decodeHtml(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(div|p|li|blockquote|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function getAttr(tag, attr) {
  const match = tag.match(new RegExp(`${attr}="([^"]*)"`, "i"));
  return match ? decodeHtml(match[1]) : null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseMessage(block) {
  const post = block.match(/data-post="([^"]+)"/)?.[1];
  if (!post) return null;

  const id = Number(post.split("/").at(-1));
  const datetime = block.match(/<time datetime="([^"]+)"/)?.[1] ?? null;
  const views = htmlToText(block.match(/<span class="tgme_widget_message_views">([\s\S]*?)<\/span>/)?.[1] ?? "");

  const textMatch = block.match(/<div class="tgme_widget_message_text js-message_text"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<div class="tgme_widget_message_footer/);
  const textHtml = textMatch?.[1] ?? "";
  const text = htmlToText(textHtml);

  const anchors = [...block.matchAll(/<a\b[^>]*>/gi)].map((match) => match[0]);
  const links = unique(anchors.map((tag) => getAttr(tag, "href")));

  const media = [];
  for (const photo of block.matchAll(/class="[^"]*tgme_widget_message_photo_wrap[^"]*"[^>]*style="[^"]*background-image:url\('([^']+)'\)[^"]*"[^>]*href="([^"]+)"/gi)) {
    media.push({ type: "photo", previewUrl: decodeHtml(photo[1]), telegramUrl: decodeHtml(photo[2]) });
  }
  for (const video of block.matchAll(/class="[^"]*tgme_widget_message_video_player[^"]*"[^>]*href="([^"]+)"[\s\S]*?background-image:url\('([^']+)'\)[\s\S]*?<time[^>]*>([\s\S]*?)<\/time>/gi)) {
    media.push({
      type: "video",
      previewUrl: decodeHtml(video[2]),
      telegramUrl: decodeHtml(video[1]),
      duration: htmlToText(video[3]),
    });
  }

  return {
    id,
    post,
    url: `https://t.me/${post}`,
    datetime,
    views,
    text,
    textHtml,
    links,
    media,
  };
}

function parsePage(html) {
  const before = html.match(/class="tme_messages_more js-messages_more" data-before="(\d+)"/)?.[1] ?? null;
  const blocks = html
    .split('<div class="tgme_widget_message_wrap js-widget_message_wrap">')
    .slice(1)
    .map((part) => part.split('<div class="tgme_widget_message_wrap js-widget_message_wrap">')[0]);

  return {
    before,
    messages: blocks.map(parseMessage).filter(Boolean),
  };
}

function extractEntities(text) {
  const usernames = unique([...text.matchAll(/(?<![\w])@([A-Za-z0-9_]{4,32})/g)].map((m) => `@${m[1]}`));
  const telegramIds = unique(
    [...text.matchAll(/(?:\bID\b|\bId\b|\bid\b|Id клона:)\s*:?\s*`?\s*(\d{5,15})/g)].map((m) => m[1]),
  );
  const phoneCandidates = [
    ...[...text.matchAll(/(?:^|\n)\s*(?:тел(?:ефон)?\.?|номер)\s*:?\s*([+]?[\d\s()*-]{8,24})/giu)].map((m) => ({
      raw: m[1],
      labelled: true,
    })),
    ...[...text.matchAll(/(?:\+\s*7|8)[\d\s()*-]{8,24}/g)].map((m) => ({ raw: m[0], labelled: false })),
  ];
  const phones = unique(
    phoneCandidates
      .filter(({ raw, labelled }) => {
        const compact = raw.replace(/[^\d*]/g, "");
        const normalized = raw.replace(/\s+/g, "");
        if (compact.length < 10) return false;
        if (labelled) return true;
        if (normalized.startsWith("+")) return true;
        return normalized.startsWith("8") && /[*()\s-]/.test(raw);
      })
      .map(({ raw }) => raw.replace(/\s+/g, ""))
      .filter((phone) => {
        const digits = phone.replace(/\D/g, "");
        return !telegramIds.includes(digits);
      }),
  );
  const fio = unique(
    [...text.matchAll(/ФИО\s*:?\s*([^\n]+)/gi)]
      .map((m) => m[1].replace(/^`|`$/g, "").trim())
      .filter(Boolean),
  );
  return { usernames, telegramIds, phones, fio };
}

function toCsvCell(value) {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

async function fetchPage(before) {
  const url = before ? `${BASE_URL}?before=${before}` : BASE_URL;
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  return { url, html: await res.text() };
}

async function fetchPost(id) {
  const url = `${POST_URL}/${id}?embed=1&mode=tme`;
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  return { url, html: await res.text() };
}

async function scrapeHistory() {
  const seenIds = new Set();
  const messages = [];
  let before = null;
  let page = 0;
  let emptyPages = 0;

  while (true) {
    page += 1;
    const { html } = await fetchPage(before);
    const parsed = parsePage(html);
    const newMessages = parsed.messages.filter((message) => !seenIds.has(message.id));

    for (const message of newMessages) {
      seenIds.add(message.id);
      messages.push({ ...message, entities: extractEntities(message.text) });
    }

    console.log(
      `page=${page} before=${before ?? "-"} next=${parsed.before ?? "-"} messages=${parsed.messages.length} new=${newMessages.length} total=${messages.length}`,
    );

    if (newMessages.length === 0) emptyPages += 1;
    else emptyPages = 0;

    if (!parsed.before || parsed.before === before || emptyPages >= 3) break;
    before = parsed.before;

    await sleep(450);
  }

  return { mode: "history", messages };
}

async function scrapeDirect(maxId) {
  const messages = [];
  const concurrency = 8;
  let nextId = 1;
  let checked = 0;

  async function worker() {
    while (nextId <= maxId) {
      const id = nextId;
      nextId += 1;

      try {
        const { html } = await fetchPost(id);
        const message = parseMessage(html);
        if (message) {
          messages.push({ ...message, entities: extractEntities(message.text) });
        }
      } catch (error) {
        console.warn(`post=${id} error=${error.message}`);
      }

      checked += 1;
      if (checked % 100 === 0 || checked === maxId) {
        console.log(`checked=${checked}/${maxId} found=${messages.length}`);
      }

      await sleep(80);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { mode: "direct", messages };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const directMode = process.argv.includes("--direct");
  const maxId = Number(readArg("--max-id") ?? 2955);
  const result = directMode ? await scrapeDirect(maxId) : await scrapeHistory();
  const messages = result.messages;

  messages.sort((a, b) => a.id - b.id);

  const generatedAt = new Date().toISOString();
  const json = {
    source: BASE_URL,
    sourceMode: result.mode,
    channel: CHANNEL,
    generatedAt,
    count: messages.length,
    minId: messages.at(0)?.id ?? null,
    maxId: messages.at(-1)?.id ?? null,
    messages,
  };

  const rows = [
    ["id", "datetime", "url", "fio", "telegramIds", "usernames", "phones", "text", "mediaCount", "links"].map(toCsvCell).join(","),
    ...messages.map((message) =>
      [
        message.id,
        message.datetime,
        message.url,
        message.entities.fio,
        message.entities.telegramIds,
        message.entities.usernames,
        message.entities.phones,
        message.text,
        message.media.length,
        message.links,
      ]
        .map(toCsvCell)
        .join(","),
    ),
  ].join("\n");

  await writeFile(path.join(OUT_DIR, "blacklist-pvz-raw.json"), `${JSON.stringify(json, null, 2)}\n`, "utf8");
  await writeFile(path.join(OUT_DIR, "blacklist-pvz-raw.csv"), `${rows}\n`, "utf8");
  await writeFile(
    path.join(OUT_DIR, "blacklist-pvz-summary.json"),
    `${JSON.stringify(
      {
        source: BASE_URL,
        sourceMode: result.mode,
        generatedAt,
        count: messages.length,
        minId: json.minId,
        maxId: json.maxId,
        withText: messages.filter((message) => message.text).length,
        withMedia: messages.filter((message) => message.media.length > 0).length,
        withTelegramIds: messages.filter((message) => message.entities.telegramIds.length > 0).length,
        withUsernames: messages.filter((message) => message.entities.usernames.length > 0).length,
        withPhones: messages.filter((message) => message.entities.phones.length > 0).length,
        outputFiles: ["blacklist-pvz-raw.json", "blacklist-pvz-raw.csv"],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
