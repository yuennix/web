import { Router, type IRouter } from "express";
import { db, usersTable, domainsTable, userDomainAssignmentsTable } from "@workspace/db";
import { eq, count, and } from "drizzle-orm";
import { createClerkClient } from "@clerk/backend";

const router: IRouter = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "yuenaquino17";

function checkAdminPassword(req: any, res: any, next: any) {
  const pwd = req.headers["x-admin-password"] as string | undefined;
  if (!pwd || pwd !== ADMIN_PASSWORD) {
    res.status(403).json({ error: "Invalid admin password" });
    return;
  }
  next();
}

function durationToDate(duration: string): Date | null {
  const now = new Date();
  if (duration === "1d") {
    now.setDate(now.getDate() + 1);
    return now;
  }
  if (duration === "7d") {
    now.setDate(now.getDate() + 7);
    return now;
  }
  if (duration === "30d") {
    now.setDate(now.getDate() + 30);
    return now;
  }
  return null;
}

router.post("/admin/auth", (req, res): void => {
  const { password } = req.body as { password?: string };
  if (!password || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Wrong password" });
    return;
  }
  res.json({ ok: true });
});

router.get("/admin/users", checkAdminPassword, async (_req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const users = await db
    .select()
    .from(usersTable)
    .orderBy(usersTable.createdAt);

  const now = new Date();
  const mapped = users.map((u) => {
    const expired = u.premiumExpiresAt && u.premiumExpiresAt < now;
    const effectiveTier = (u.tier === "premium" && expired) ? "free" : u.tier;
    return {
      id: u.id,
      clerkId: u.clerkId,
      email: u.email,
      username: u.username,
      tier: effectiveTier,
      isAdmin: u.isAdmin,
      premiumExpiresAt: u.premiumExpiresAt,
      createdAt: u.createdAt,
    };
  });

  const total = mapped.length;
  const premium = mapped.filter((u) => u.tier === "premium").length;
  const free = mapped.filter((u) => u.tier === "free").length;

  res.json({ users: mapped, stats: { total, premium, free } });
});

router.patch("/admin/users/:id/tier", checkAdminPassword, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { tier, duration } = req.body as { tier: string; duration?: string };

  if (!["free", "premium"].includes(tier)) {
    res.status(400).json({ error: "tier must be 'free' or 'premium'" });
    return;
  }

  let premiumExpiresAt: Date | null = null;
  if (tier === "premium" && duration) {
    premiumExpiresAt = durationToDate(duration);
  }

  const [updated] = await db
    .update(usersTable)
    .set({ tier, premiumExpiresAt: tier === "free" ? null : premiumExpiresAt })
    .where(eq(usersTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ id: updated.id, tier: updated.tier, premiumExpiresAt: updated.premiumExpiresAt });
});

router.post("/admin/users/import", checkAdminPassword, async (req, res): Promise<void> => {
  const { emails } = req.body as { emails?: string[] };
  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    res.status(400).json({ error: "emails array required" });
    return;
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    res.status(500).json({ error: "CLERK_SECRET_KEY is not configured on the server. Cannot verify Clerk accounts." });
    return;
  }

  const clerkClient = createClerkClient({ secretKey });

  const [{ count: dbCount }] = await db.select({ count: count() }).from(usersTable);
  let isEmpty = Number(dbCount) === 0;
  let created = 0;
  let skipped = 0;
  const notInClerk: string[] = [];

  for (const rawEmail of emails) {
    const email = rawEmail.trim().toLowerCase();
    if (!email) continue;

    // Always verify the email exists in Clerk before adding
    const results = await clerkClient.users.getUserList({ emailAddress: [email], limit: 1 });
    if (results.data.length === 0) {
      notInClerk.push(email);
      continue;
    }

    const clerkUser = results.data[0];
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.clerkId, clerkUser.id));
    if (existing) { skipped++; continue; }

    const isFirst = isEmpty && created === 0;
    await db.insert(usersTable).values({
      clerkId: clerkUser.id,
      email,
      username: clerkUser.username ?? null,
      tier: isFirst ? "premium" : "free",
      isAdmin: isFirst,
    });
    created++;
  }

  res.json({ ok: true, created, skipped, notInClerk });
});

router.post("/admin/sync-from-clerk", checkAdminPassword, async (_req, res): Promise<void> => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    res.status(500).json({ error: "CLERK_SECRET_KEY not configured on server" });
    return;
  }

  const clerkClient = createClerkClient({ secretKey });

  // Fetch all users from Clerk (paginate if needed)
  let allClerkUsers: { id: string; emailAddresses: { emailAddress: string }[]; username: string | null }[] = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const page = await clerkClient.users.getUserList({ limit, offset });
    allClerkUsers = allClerkUsers.concat(
      page.data.map((u) => ({
        id: u.id,
        emailAddresses: u.emailAddresses.map((e) => ({ emailAddress: e.emailAddress })),
        username: u.username ?? null,
      }))
    );
    if (page.data.length < limit) break;
    offset += limit;
  }

  let created = 0;
  let skipped = 0;

  // Check if DB is empty (first user auto-promoted)
  const [{ count: dbCount }] = await db.select({ count: count() }).from(usersTable);
  const isEmpty = Number(dbCount) === 0;

  for (const clerkUser of allClerkUsers) {
    const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
    const username = clerkUser.username ?? null;

    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.clerkId, clerkUser.id));

    if (existing) {
      skipped++;
    } else {
      const isFirst = isEmpty && created === 0;
      await db.insert(usersTable).values({
        clerkId: clerkUser.id,
        email,
        username,
        tier: isFirst ? "premium" : "free",
        isAdmin: isFirst,
      });
      created++;
    }
  }

  res.json({ ok: true, total: allClerkUsers.length, created, skipped });
});

router.post("/admin/domains/import-from-temp-mail", checkAdminPassword, async (_req, res): Promise<void> => {
  try {
    const response = await fetch("https://api.internal.temp-mail.io/api/v3/domains", {
      headers: { "Accept": "application/json" },
    });
    if (!response.ok) {
      res.status(502).json({ error: "Failed to fetch domains from temp-mail.io" });
      return;
    }
    const json = await response.json() as { domains?: { name: string }[] };
    const remoteDomains: { name: string }[] = json.domains ?? [];

    let added = 0;
    let skipped = 0;
    const addedNames: string[] = [];

    for (const { name } of remoteDomains) {
      const domain = name.toLowerCase().trim();
      if (!domain) continue;
      const existing = await db.select({ id: domainsTable.id }).from(domainsTable).where(eq(domainsTable.name, domain));
      if (existing.length > 0) {
        skipped++;
        continue;
      }
      await db.insert(domainsTable).values({ name: domain, active: true });
      addedNames.push(domain);
      added++;
    }

    res.json({ ok: true, added, skipped, domains: addedNames });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Unknown error" });
  }
});

router.delete("/admin/users/:id", checkAdminPassword, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [deleted] = await db
    .delete(usersTable)
    .where(eq(usersTable.id, id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ ok: true });
});

// ── Per-user domain assignments ─────────────────────────────────────────────

router.get("/admin/users/:id/domains", checkAdminPassword, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.id, 10);
  const assignments = await db
    .select({ domainId: userDomainAssignmentsTable.domainId })
    .from(userDomainAssignmentsTable)
    .where(eq(userDomainAssignmentsTable.userId, userId));
  res.json({ domainIds: assignments.map((a) => a.domainId) });
});

router.post("/admin/users/:id/domains/:domainId", checkAdminPassword, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.id, 10);
  const domainId = parseInt(req.params.domainId, 10);
  if (isNaN(userId) || isNaN(domainId)) {
    res.status(400).json({ error: "Invalid ids" });
    return;
  }
  await db
    .insert(userDomainAssignmentsTable)
    .values({ userId, domainId })
    .onConflictDoNothing();
  res.json({ ok: true });
});

router.delete("/admin/users/:id/domains/:domainId", checkAdminPassword, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.id, 10);
  const domainId = parseInt(req.params.domainId, 10);
  await db
    .delete(userDomainAssignmentsTable)
    .where(
      and(
        eq(userDomainAssignmentsTable.userId, userId),
        eq(userDomainAssignmentsTable.domainId, domainId)
      )
    );
  res.json({ ok: true });
});

export default router;
