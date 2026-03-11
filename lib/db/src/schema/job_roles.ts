import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";

export const jobRolesTable = pgTable("job_roles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  skills: text("skills"),
  status: text("status", { enum: ["draft", "pending_approval", "published", "closed"] }).notNull().default("draft"),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertJobRoleSchema = createInsertSchema(jobRolesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJobRole = z.infer<typeof insertJobRoleSchema>;
export type JobRole = typeof jobRolesTable.$inferSelect;
