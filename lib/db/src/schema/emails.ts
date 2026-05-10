import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const emailsTable = pgTable("emails", {
  id: serial("id").primaryKey(),
  messageId: text("message_id").notNull(),
  toAddress: text("to_address").notNull(),
  fromAddress: text("from_address").notNull(),
  subject: text("subject").notNull().default("(no subject)"),
  htmlBody: text("html_body"),
  textBody: text("text_body"),
  preview: text("preview").notNull().default(""),
  read: boolean("read").notNull().default(false),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  sizeBytes: integer("size_bytes").notNull().default(0),
});

export const insertEmailSchema = createInsertSchema(emailsTable).omit({ id: true });
export type InsertEmail = z.infer<typeof insertEmailSchema>;
export type Email = typeof emailsTable.$inferSelect;
