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
 * Returns null only when no address fields whatsoever can be found.
 *
 * Providers handled:
 *  - Hanami.run / Mailwip (multipart: recipient, sender, subject, body-html, body-plain,
 *                          stripped-text, message-headers JSON array)
 *  - Mailgun  (same fields as Hanami.run)
 *  - Postmark (JSON: From, To, Subject, HtmlBody, TextBody)
 *  - Cloudmailin (JSON: headers.{to,from,subject}, html, plain)
 *  - SendGrid (JSON: personalizations[0].to[0].email, from, subject, content[])
 *  - Generic flat JSON / form (from/to/subject/html/text)
 */
function extractEmailData(body: Record<string, unknown>, files: Express.Multer.File[]): EmailData | null {
  // --- Format 1: body.email is a JSON string (Hanami.run / Mailwip legacy) ---
  if (typeof body.email === "string") {
    try {
      const parsed = JSON.parse(body.email) as Record<string, unknown>;
      body = { ...body, ...parsed };
    } catch { /* fall through */ }
  }

  // --- Format 2: body.payload is a JSON string ---
  if (typeof body.payload === "string") {
    try {
      const parsed = JSON.parse(body.payload) as Record<string, unknown>;
      body = { ...body, ...parsed };
    } catch { /* fall through */ }
  }

  // --- Format 3: message-headers is a JSON array (Hanami.run / Mailwip / Mailgun) ---
  if (typeof body["message-headers"] === "string") {
    try {
      const headers = JSON.parse(body["message-headers"] as string) as Array<[string, string]>;
      const headerMap: Record<string, string> = {};
      for (const [k, v] of headers) headerMap[k.toLowerCase()] = v;
      // Only inject header values if not already in body
      if (!body.recipient && !body.to && headerMap["to"]) body = { ...body, to: headerMap["to"] };
      if (!body.sender && !body.from && headerMap["from"]) body = { ...body, from: headerMap["from"] };
      if (!body.subject && headerMap["subject"]) body = { ...body, subject: headerMap["subject"] };
    } catch { /* fall through */ }
  }

  // --- Format 4: Postmark ---
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

  // --- Format 5: Cloudmailin ---
  if (typeof body.headers === "object" && body.headers !== null && !Array.isArray(body.headers)) {
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

  // --- Format 6: SendGrid inbound parse ---
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

  // --- Format 7: Hanami.run / Mailwip / Mailgun multipart / generic flat ---
  // Field priority: recipient > to, sender > from, body-html > html, stripped-text > body-plain > text
  const from = pick(body, "sender", "from", "Sender", "From", "return-path", "x-original-sender");
  const to = pick(body, "recipient", "to", "Recipient", "To", "delivered-to", "x-forwarded-to", "x-original-to");
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

  // --- Format 8: nested data wrapper ---
  if (typeof body.data === "object" && body.data !== null) {
    return extractEmailData(body.data as Record<string, unknown>, files);
  }

  return null;
}

// ─── GET /api/webhook/info (admin only) ─────────────────────────────────────
router.get("/webhook/info", (req, res): void => {
  const adminPwd = process.env.ADMIN_PASSWORD || "yuenaquino17";
  const provided = req.headers["x-admin-password"] as string | undefined;
  if (!provided || provided !== adminPwd) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const secret = process.env.WEBHOOK_SECRET ?? null;
  res.json({ hasSecret: !!secret, secret });
});

// ─── POST /api/webhook/email ────────────────────────────────────────────────
router.post(
  "/webhook/email",
  upload.any(),
  async (req, res): Promise<void> => {
    // Validate webhook secret if configured
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret) {
      const provided =
        (req.headers["x-webhook-secret"] as string | undefined) ??
        (req.query.secret as string | undefined);
      if (!provided || provided !== webhookSecret) {
        res.status(401).json({ error: "Invalid webhook secret" });
        return;
      }
    }

    try {
      logger.info({
        contentType: req.headers["content-type"],
        bodyKeys: Object.keys(req.body || {}),
        bodyRaw: JSON.stringify(req.body).slice(0, 600),
        filesCount: (req.files as Express.Multer.File[] | undefined)?.length ?? 0,
      }, "Webhook received");

      const files = (req.files as Express.Multer.File[]) ?? [];
      const emailData = extractEmailData(req.body as Record<string, unknown>, files);

      if (!emailData || !emailData.to.trim()) {
        // Always return 200 so providers don't retry/mark as failed.
        // Log the full raw body so we can debug missing formats.
        logger.warn({
          body: req.body,
          bodyRaw: JSON.stringify(req.body).slice(0, 2000),
          contentType: req.headers["content-type"],
        }, "Webhook received but could not extract email data — returning 200 to suppress retries");
        res.status(200).json({ status: "ignored", reason: "Could not parse email fields" });
        return;
      }

      const fromAddress = emailData.from || "unknown@unknown.com";
      const toAddress = emailData.to.toLowerCase().trim();
      const subject = emailData.subject || "(no subject)";
      const htmlBody = emailData.html || null;
      const textBody = emailData.text || null;

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
