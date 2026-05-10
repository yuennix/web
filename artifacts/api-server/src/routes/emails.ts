import { Router, type IRouter } from "express";
import { eq, desc, count } from "drizzle-orm";
import { db, emailsTable } from "@workspace/db";
import { promises as dns } from "dns";
import {
  ListEmailsQueryParams,
  GetEmailQueryParams,
  GetEmailParams,
  GetEmailStatsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const PAGE_SIZE = 20;

router.get("/emails/stats", async (req, res): Promise<void> => {
  const parsed = GetEmailStatsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const address = parsed.data.address.toLowerCase().trim();

  const [totalResult] = await db
    .select({ count: count() })
    .from(emailsTable)
    .where(eq(emailsTable.toAddress, address));

  const [unreadResult] = await db
    .select({ count: count() })
    .from(emailsTable)
    .where(eq(emailsTable.toAddress, address));

  const [lastEmail] = await db
    .select({ receivedAt: emailsTable.receivedAt })
    .from(emailsTable)
    .where(eq(emailsTable.toAddress, address))
    .orderBy(desc(emailsTable.receivedAt))
    .limit(1);

  res.json({
    totalEmails: totalResult?.count ?? 0,
    unreadEmails: unreadResult?.count ?? 0,
    lastChecked: lastEmail?.receivedAt?.toISOString() ?? null,
  });
});

router.get("/emails", async (req, res): Promise<void> => {
  const parsed = ListEmailsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const address = parsed.data.address.toLowerCase().trim();
  const page = parsed.data.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  const [totalResult] = await db
    .select({ count: count() })
    .from(emailsTable)
    .where(eq(emailsTable.toAddress, address));

  const total = totalResult?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const emails = await db
    .select()
    .from(emailsTable)
    .where(eq(emailsTable.toAddress, address))
    .orderBy(desc(emailsTable.receivedAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  res.json({
    emails: emails.map(e => ({
      id: String(e.id),
      from: e.fromAddress,
      subject: e.subject,
      date: e.receivedAt.toISOString(),
      read: e.read,
      preview: e.preview,
    })),
    total,
    page,
    totalPages,
  });
});

router.get("/emails/:id", async (req, res): Promise<void> => {
  const params = GetEmailParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const queryParsed = GetEmailQueryParams.safeParse(req.query);
  if (!queryParsed.success) {
    res.status(400).json({ error: queryParsed.error.message });
    return;
  }

  const id = parseInt(params.data.id, 10);
  const address = queryParsed.data.address.toLowerCase().trim();

  const [email] = await db
    .select()
    .from(emailsTable)
    .where(eq(emailsTable.id, id));

  if (!email || email.toAddress !== address) {
    res.status(404).json({ error: "Email not found" });
    return;
  }

  await db
    .update(emailsTable)
    .set({ read: true })
    .where(eq(emailsTable.id, id));

  res.json({
    id: String(email.id),
    from: email.fromAddress,
    to: email.toAddress,
    subject: email.subject,
    date: email.receivedAt.toISOString(),
    htmlBody: email.htmlBody ?? null,
    textBody: email.textBody ?? null,
    read: true,
    attachments: [],
  });
});

// Clear all emails for an address
router.delete("/emails", async (req, res): Promise<void> => {
  const { address } = req.query;
  if (!address || typeof address !== "string") {
    res.status(400).json({ error: "address query param required" });
    return;
  }
  const addr = address.toLowerCase().trim();
  await db.delete(emailsTable).where(eq(emailsTable.toAddress, addr));
  res.json({ ok: true });
});

// Validate whether an email address's domain has valid MX records
router.post("/emails/validate", async (req, res): Promise<void> => {
  const { emails } = req.body as { emails?: string[] };
  if (!Array.isArray(emails)) {
    res.status(400).json({ error: "emails array required" });
    return;
  }

  const results: { email: string; valid: boolean; reason?: string }[] = [];

  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      results.push({ email, valid: false, reason: "Invalid email format" });
      continue;
    }

    const domain = email.split("@")[1];

    // Gmail-specific format check
    if (domain === "gmail.com") {
      const localPart = email.split("@")[0];
      const gmailRegex = /^[a-z0-9]([a-z0-9.]{4,28}[a-z0-9])$/;
      if (!gmailRegex.test(localPart) || localPart.includes("..")) {
        results.push({ email, valid: false, reason: "Invalid Gmail format (must be 6–30 chars, letters/numbers/dots only, no consecutive dots)" });
        continue;
      }
    }

    // MX record lookup — confirms the domain can receive email
    try {
      const mx = await dns.resolveMx(domain);
      if (!mx || mx.length === 0) {
        results.push({ email, valid: false, reason: `Domain ${domain} has no mail server (MX records)` });
      } else {
        results.push({ email, valid: true });
      }
    } catch {
      results.push({ email, valid: false, reason: `Domain ${domain} not found or has no MX records` });
    }
  }

  res.json({ results });
});

export default router;
