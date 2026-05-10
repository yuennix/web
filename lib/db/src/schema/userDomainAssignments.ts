import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { domainsTable } from "./domains";

export const userDomainAssignmentsTable = pgTable(
  "user_domain_assignments",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    domainId: integer("domain_id")
      .notNull()
      .references(() => domainsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.domainId)]
);

export type UserDomainAssignment = typeof userDomainAssignmentsTable.$inferSelect;
