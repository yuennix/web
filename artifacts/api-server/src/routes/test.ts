import { Router, type IRouter } from "express";
import { db, emailsTable, domainsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { broadcastNewEmail } from "../lib/sse";

const router: IRouter = Router();

router.post("/test/send-email", async (req, res): Promise<void> => {
  try {
    const { to, from, subject, body } = req.body as {
      to?: string;
      from?: string;
      subject?: string;
      body?: string;
    };

    const toAddress = (to || "inbox@weyn.store").toLowerCase().trim();
    const fromAddress = from || "test@example.com";
    const emailSubject = subject || "Test Email";
    const emailBody = body || "<p>This is a <strong>test email</strong> to verify your inbox is working!</p>";
    const toHost = toAddress.split("@")[1];

    if (toHost) {
      const knownDomains = await db.select().from(domainsTable).where(eq(domainsTable.name, toHost));
      if (knownDomains.length === 0) {
        await db.insert(domainsTable).values({ name: toHost, active: true });
      }
    }

    const messageId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const isHtml = /<[a-z][\s\S]*>/i.test(emailBody);

    const [inserted] = await db.insert(emailsTable).values({
      messageId,
      toAddress,
      fromAddress,
      subject: emailSubject,
      htmlBody: isHtml ? emailBody : null,
      textBody: isHtml ? null : emailBody,
      preview: emailBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200),
      read: false,
      receivedAt: new Date(),
      sizeBytes: Buffer.byteLength(emailBody, "utf8"),
    }).returning();

    broadcastNewEmail(toAddress, inserted.id);
    res.status(200).json({ status: "ok", emailId: inserted.id, to: toAddress });
  } catch (err) {
    res.status(500).json({ error: "Failed to send test email" });
  }
});

export default router;
