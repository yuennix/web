import { Router, type IRouter } from "express";
import { eq, count, or } from "drizzle-orm";
import { db, usersTable, userDomainAssignmentsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

async function buildProfile(user: typeof usersTable.$inferSelect) {
  const assignments = await db
    .select({ domainId: userDomainAssignmentsTable.domainId })
    .from(userDomainAssignmentsTable)
    .where(eq(userDomainAssignmentsTable.userId, user.id));
  return {
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    username: user.username,
    tier: user.tier,
    isAdmin: user.isAdmin,
    premiumExpiresAt: user.premiumExpiresAt,
    allowedDomainIds: assignments.map((a) => a.domainId),
  };
}

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const clerkId = (req as any).clerkUserId as string;

  let [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId));

  if (!user) {
    [user] = await db
      .insert(usersTable)
      .values({ clerkId, email: "", tier: "free", isAdmin: false })
      .returning();
  }

  const now = new Date();
  if (user.tier === "premium" && user.premiumExpiresAt && user.premiumExpiresAt < now) {
    const [downgraded] = await db
      .update(usersTable)
      .set({ tier: "free", premiumExpiresAt: null })
      .where(eq(usersTable.clerkId, clerkId))
      .returning();
    user = downgraded;
  }

  res.json(await buildProfile(user));
});

router.post("/users/me/sync", async (req, res): Promise<void> => {
  const { clerkId, email, username, sessionToken: clientToken } = req.body as {
    clerkId?: string;
    email?: string;
    username?: string;
    sessionToken?: string;
  };

  if (!clerkId) {
    res.status(400).json({ error: "clerkId is required" });
    return;
  }

  const conditions = [eq(usersTable.clerkId, clerkId)];
  if (email) conditions.push(eq(usersTable.email, email));
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(or(...conditions));

  let result: typeof usersTable.$inferSelect;

  if (existing) {
    const [updated] = await db
      .update(usersTable)
      .set({
        clerkId,
        email: email ?? existing.email,
        username: username ?? existing.username,
      })
      .where(eq(usersTable.id, existing.id))
      .returning();

    let current = updated;
    const now = new Date();
    if (current.tier === "premium" && current.premiumExpiresAt && current.premiumExpiresAt < now) {
      const [downgraded] = await db
        .update(usersTable)
        .set({ tier: "free", premiumExpiresAt: null })
        .where(eq(usersTable.clerkId, clerkId))
        .returning();
      current = downgraded;
    }

    if (!current.isAdmin) {
      const dbToken = current.sessionToken;

      if (!clientToken) {
        const newToken = crypto.randomUUID();
        const [saved] = await db
          .update(usersTable)
          .set({ sessionToken: newToken })
          .where(eq(usersTable.clerkId, clerkId))
          .returning();
        result = saved;
        return res.json({ ...(await buildProfile(result)), sessionToken: newToken, kicked: false });
      }

      if (clientToken === dbToken) {
        result = current;
        return res.json({ ...(await buildProfile(result)), sessionToken: dbToken, kicked: false });
      }

      return res.json({ ...(await buildProfile(current)), sessionToken: null, kicked: true });
    }

    result = current;
  } else {
    const [{ count: userCount }] = await db
      .select({ count: count() })
      .from(usersTable);
    const isFirstUser = Number(userCount) === 0;

    const [created] = await db
      .insert(usersTable)
      .values({
        clerkId,
        email: email ?? "",
        username: username ?? null,
        tier: isFirstUser ? "premium" : "free",
        isAdmin: isFirstUser,
      })
      .returning();
    result = created;
  }

  if (!result.sessionToken && !result.isAdmin) {
    const newToken = crypto.randomUUID();
    const [saved] = await db
      .update(usersTable)
      .set({ sessionToken: newToken })
      .where(eq(usersTable.clerkId, clerkId))
      .returning();
    result = saved;
    return res.json({ ...(await buildProfile(result)), sessionToken: newToken, kicked: false });
  }

  res.json({ ...(await buildProfile(result)), sessionToken: result.sessionToken ?? null, kicked: false });
});

export default router;
