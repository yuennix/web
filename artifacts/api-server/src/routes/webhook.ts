import { Router, type IRouter } from "express";
import multer from "multer";
import { db, emailsTable, domainsTable, usersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { logger } from "../lib/logger";
import { broadcastNewEmail } from "../lib/sse";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

interface EmailData {
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  text?: string;
  html?: string;
  recipient?: string;
  sender?: string;
  headers?: Record<string, string>[];
}

function extractEmailData(body: Record<string, unknown>, files: Express.Multer.File[]): EmailData | null {
  // Format 1: body.email is a JSON string (original Hanami.run format)
  if (typeof body.email === "string") {
    try {
      return JSON.parse(body.email) as EmailData;
    } catch {
      logger.warn("Failed to parse body.email as JSON");
    }
  }

  // Format 2: body has email fields directly as JSON body
  if (body.from || body.to || body.recipient || body.sender) {
    return body as EmailData;
  }

  // Format 3: body.payload is a JSON string
  if (typeof body.payload === "string") {
    try {
      return JSON.parse(body.payload) as EmailData;
    } catch {
      logger.warn("Failed to parse body.payload as JSON");
    }
  }

  // Format 4: body itself has nested email data
  if (typeof body.data === "object" && body.data !== null) {
    return body.data as EmailData;
  }

  return null;
}

router.post(
  "/webhook/email",
  upload.any(),
  async (req, res): Promise<void> => {
    try {
      // Log full request for debugging
      logger.info({
        contentType: req.headers["content-type"],
        bodyKeys: Object.keys(req.body || {}),
        bodyRaw: JSON.stringify(req.body).slice(0, 500),
        filesCount: (req.files as Express.Multer.File[] | undefined)?.length ?? 0,
      }, "Webhook received");

      const files = (req.files as Express.Multer.File[]) ?? [];
      const emailData = extractEmailData(req.body as Record<string, unknown>, files);

      if (!emailData) {
        logger.warn({ body: req.body }, "Could not extract email data from webhook");
        res.status(400).json({ error: "Could not parse email data" });
        return;
      }

      const fromAddress = emailData.from ?? emailData.sender ?? "unknown@unknown.com";
      const toAddress = (emailData.to ?? emailData.recipient ?? "").toLowerCase().trim();
      const subject = emailData.subject ?? "(no subject)";
      const body = emailData.body ?? emailData.html ?? emailData.text ?? "";

      if (!toAddress) {
        logger.warn("Webhook received with empty to address");
        res.status(400).json({ error: "Missing to address" });
        return;
      }

      const toHost = toAddress.split("@")[1];
      if (toHost) {
        const knownDomains = await db
          .select()
          .from(domainsTable)
          .where(eq(domainsTable.name, toHost));

        if (knownDomains.length === 0) {
          await db.insert(domainsTable).values({ name: toHost, active: true });
          logger.info({ domain: toHost }, "Auto-registered domain from webhook");
        }
      }

      const isHtml = /<[a-z][\s\S]*>/i.test(body);
      const htmlBody = isHtml ? body : null;
      const textBody = isHtml ? null : body;

      const preview = body
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);

      const messageId = `webhook-${Date.now()}-${Math.random().toString(36).slice(2)}`;

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
          sizeBytes: Buffer.byteLength(JSON.stringify(emailData), "utf8"),
        })
        .returning();

      logger.info(
        { emailId: inserted.id, to: toAddress, from: fromAddress, subject },
        "Email received and stored"
      );

      broadcastNewEmail(toAddress, inserted.id);

      res.status(200).json({ status: "ok", emailId: inserted.id });
    } catch (err) {
      logger.error({ err }, "Failed to process incoming webhook");
      res.status(500).json({ error: "Internal error" });
    }
  }
);

// Clerk user.created webhook — configure in Clerk Dashboard → Webhooks
// Endpoint: POST /api/webhook/clerk
router.post("/webhook/clerk", async (req, res): Promise<void> => {
  try {
    const event = req.body as { type?: string; data?: { id?: string; email_addresses?: { email_address: string }[]; username?: string } };
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

    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, clerkId));

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
