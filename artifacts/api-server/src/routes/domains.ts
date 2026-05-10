import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, domainsTable } from "@workspace/db";
import { AddDomainBody, DeleteDomainParams, UpdateDomainBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/domains", async (req, res): Promise<void> => {
  const domains = await db.select().from(domainsTable).orderBy(domainsTable.createdAt);
  res.json({ domains: domains.map(d => ({
    id: d.id,
    name: d.name,
    active: d.active,
    premiumOnly: d.premiumOnly,
    createdAt: d.createdAt.toISOString(),
  })) });
});

router.post("/domains", async (req, res): Promise<void> => {
  const parsed = AddDomainBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const name = parsed.data.name.toLowerCase().trim();
  if (!name || !/^[a-z0-9]+([\-.][a-z0-9]+)*\.[a-z]{2,}$/.test(name)) {
    res.status(400).json({ error: "Invalid domain name" });
    return;
  }

  const existing = await db.select().from(domainsTable).where(eq(domainsTable.name, name));
  if (existing.length > 0) {
    res.status(400).json({ error: "Domain already exists" });
    return;
  }

  const [domain] = await db.insert(domainsTable).values({ name, active: true }).returning();
  res.status(201).json({
    id: domain.id,
    name: domain.name,
    active: domain.active,
    createdAt: domain.createdAt.toISOString(),
  });
});

router.patch("/domains/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid domain id" });
    return;
  }

  const parsed = UpdateDomainBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [domain] = await db
    .update(domainsTable)
    .set({ premiumOnly: parsed.data.premiumOnly })
    .where(eq(domainsTable.id, id))
    .returning();

  if (!domain) {
    res.status(404).json({ error: "Domain not found" });
    return;
  }

  res.json({
    id: domain.id,
    name: domain.name,
    active: domain.active,
    premiumOnly: domain.premiumOnly,
    createdAt: domain.createdAt.toISOString(),
  });
});

router.delete("/domains/:id", async (req, res): Promise<void> => {
  const params = DeleteDomainParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [domain] = await db
    .delete(domainsTable)
    .where(eq(domainsTable.id, params.data.id))
    .returning();

  if (!domain) {
    res.status(404).json({ error: "Domain not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
