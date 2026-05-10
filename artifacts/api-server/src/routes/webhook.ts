import { Router, type IRouter } from "express";
import multer from "multer";
import { db, emailsTable, domainsTable, usersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { logger } from "../lib/logger";
import { broadcastNewEmail } from "../lib/sse";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

interface EmailData {
  from: string;
  to: string;
  subject: string;
  html: string | null;
  text: string | null;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function makePreview(html: string | null, text: string | null): string {
  const raw = text
    ? text
    : html
      ? html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<[^>]+>/g, " ")
      : "";
  return decodeHtmlEntities(raw.replace(/\s+/g, " ").trim()).slice(0, 250);
}

function pick(body: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = body[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/**
 * Extract from/to/subject/html/text from any known provider format.
 *
 * Providers handled:
 *  - Mailgun  (multipart: from, recipient, subject, body-html, body-plain, stripped-text)
 *  - SendGrid (JSON: from{email}, personalizations[0].to[0].email, subject, content[type=text/html])
 *  - Postmark (JSON: From, To, Subject, HtmlBody, TextBody)
 *  - Cloudmailin (JSON: headers.to, headers.from, headers.subject, html, plain)
 *  - Forwardemail / generic (JSON: from, to, subject, html, text)
 *  - Raw body.email JSON string (Hanami / custom)
 */
function extractEmailData(body: Record<string, unknown>, files: Express.Multer.File[]): EmailData | null {
  // --- Format 1: body.email is a JSON string ---
  if (typeof body.email === "string") {
    try {
      const parsed = JSON.parse(body.email) as Record<string, unknown>;
      body = parsed;
    } catch { /* fall through */ }
  }

  // --- Format 2: body.payload is a JSON string ---
  if (typeof body.payload === "string") {
    try {
      const parsed = JSON.parse(body.payload) as Record<string, unknown>;
      body = parsed;
    } catch { /* fall through */ }
  }

  // --- Format 3: Postmark ---
  if (typeof body.From === "string" || typeof body.To === "string") {
    return {
      from: pick(body, "From", "from"),
      to: pick(body, "To", "to", "OriginalRecipient", "recipient"),
      subject: pick(body, "Subject", "subject"),
      html: typeof body.HtmlBody === "string" ? body.HtmlBody : null,
      text: typeof body.TextBody === "string" ? body.TextBody
          : typeof body.StrippedTextReply === "string" ? body.StrippedTextReply
          : null,
    };
  }

  // --- Format 4: Cloudmailin ---
  if (typeof body.headers === "object" && body.headers !== null) {
    const h = body.headers as Record<string, unknown>;
    const to = pick(h, "to", "delivered-to", "x-original-to");
    const from = pick(h, "from", "reply-to");
    const subject = pick(h, "subject");
    if (to || from) {
      return {
        from,
        to,
        subject,
        html: typeof body.html === "string" ? body.html : null,
        text: typeof body.plain === "string" ? body.plain
            : typeof body.text === "string" ? body.text
            : null,
      };
    }
  }

  // --- Format 5: SendGrid inbound parse ---
  if (Array.isArray(body.personalizations)) {
    const pers = body.personalizations as Array<{ to?: Array<{ email?: string }> }>;
    const to = pers[0]?.to?.[0]?.email ?? "";
    const fromObj = body.from as { email?: string } | undefined;
    const from = typeof body.from === "string" ? body.from : fromObj?.email ?? "";
    const subject = pick(body, "subject");
    let html: string | null = null;
    let text: string | null = null;
    if (Array.isArray(body.content)) {
      for (const c of body.content as Array<{ type?: string; value?: string }>) {
        if (c.type === "text/html") html = c.value ?? null;
        if (c.type === "text/plain") text = c.value ?? null;
      }
    }
    return { from, to, subject, html, text };
  }

  // --- Format 6: Mailgun multipart / generic flat body ---
  const from = pick(body, "from", "sender", "From", "Sender");
  const to = pick(body, "to", "recipient", "To", "Recipient", "delivered-to");
  if (from || to) {
    return {
      from,
      to,
      subject: pick(body, "subject", "Subject"),
      html: typeof body["body-html"] === "string" ? body["body-html"]
          : typeof body.html === "string" ? body.html
          : typeof body.Html === "string" ? body.Html
          : null,
      text: typeof body["stripped-text"] === "string" ? body["stripped-text"]
          : typeof body["body-plain"] === "string" ? body["body-plain"]
          : typeof body.text === "string" ? body.text
          : typeof body.Text === "string" ? body.Text
          : null,
    };
  }

  // --- Format 7: nested data wrapper ---
  if (typeof body.data === "object" && body.data !== null) {
    return extractEmailData(body.data as Record<string, unknown>, files);
  }

  return null;
}

// ─── POST /api/webhook/email ────────────────────────────────────────────────
router.post(
  "/webhook/email",
  upload.any(),
  async (req, res): Promise<void> => {
    try {
      logger.info({
        contentType: req.headers["content-type"],
        bodyKeys: Object.keys(req.body || {}),
        bodyRaw: JSON.stringify(req.body).slice(0, 600),
        filesCount: (req.files as Express.Multer.File[] | undefined)?.length ?? 0,
      }, "Webhook received");

      const files = (req.files as Express.Multer.File[]) ?? [];
      const emailData = extractEmailData(req.body as Record<string, unknown>, files);

      if (!emailData) {
        logger.warn({ body: req.body }, "Could not extract email data from webhook");
        res.status(400).json({ error: "Could not parse email data" });
        return;
      }

      const fromAddress = emailData.from || "unknown@unknown.com";
      const toAddress = emailData.to.toLowerCase().trim();
      const subject = emailData.subject || "(no subject)";
      const htmlBody = emailData.html || null;
      const textBody = emailData.text || null;

      if (!toAddress) {
        logger.warn("Webhook received with empty to address");
        res.status(400).json({ error: "Missing to address" });
        return;
      }

      // Auto-register domain if not known
      const toHost = toAddress.split("@")[1];
      if (toHost) {
        const knownDomains = await db.select().from(domainsTable).where(eq(domainsTable.name, toHost));
        if (knownDomains.length === 0) {
          await db.insert(domainsTable).values({ name: toHost, active: true });
          logger.info({ domain: toHost }, "Auto-registered domain from webhook");
        }
      }

      const preview = makePreview(htmlBody, textBody);
      const messageId = `wh-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const bodyForSize = htmlBody ?? textBody ?? "";

      const [inserted] = await db
        .insert(emailsTable)
        .values({
          messageId,
          toAddress,
          fromAddress,
          subject,
          htmlBody,
          textBody,
          preview,
          read: false,
          receivedAt: new Date(),
          sizeBytes: Buffer.byteLength(bodyForSize, "utf8"),
        })
        .returning();

      logger.info({ emailId: inserted.id, to: toAddress, from: fromAddress, subject }, "Email stored");
      broadcastNewEmail(toAddress, inserted.id);
      res.status(200).json({ status: "ok", emailId: inserted.id });
    } catch (err) {
      logger.error({ err }, "Failed to process incoming webhook");
      res.status(500).json({ error: "Internal error" });
    }
  }
);

// ─── POST /api/webhook/clerk ─────────────────────────────────────────────────
router.post("/webhook/clerk", async (req, res): Promise<void> => {
  try {
    const event = req.body as {
      type?: string;
      data?: { id?: string; email_addresses?: { email_address: string }[]; username?: string };
    };

    if (event.type !== "user.created" && event.type !== "user.updated") {
      res.json({ ok: true, skipped: true });
      return;
    }

    const clerkId = event.data?.id;
    const email = event.data?.email_addresses?.[0]?.email_address ?? "";
    const username = event.data?.username ?? null;

    if (!clerkId) {
      res.status(400).json({ error: "Missing user id" });
      return;
    }

    const [existing] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));

    if (existing) {
      await db.update(usersTable)
        .set({ email: email || existing.email, username: username ?? existing.username })
        .where(eq(usersTable.clerkId, clerkId));
      res.json({ ok: true, action: "updated" });
      return;
    }

    const [{ count: dbCount }] = await db.select({ count: count() }).from(usersTable);
    const isFirst = Number(dbCount) === 0;

    await db.insert(usersTable).values({
      clerkId,
      email,
      username,
      tier: isFirst ? "premium" : "free",
      isAdmin: isFirst,
    });

    logger.info({ clerkId, email }, "User created via Clerk webhook");
    res.json({ ok: true, action: "created" });
  } catch (err) {
    logger.error({ err }, "Clerk webhook error");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
