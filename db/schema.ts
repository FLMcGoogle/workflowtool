import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_projects_owner_updated").on(table.ownerId, table.updatedAt)]);

export const workflows = sqliteTable("workflows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull(),
  projectId: integer("project_id").references(() => projects.id),
  name: text("name").notNull(),
  setting: text("setting").notNull(),
  workflowType: text("workflow_type").notNull(),
  department: text("department").notNull().default(""),
  state: text("state").notNull().default("Current state"),
  nodes: text("nodes").notNull().default("[]"),
  edges: text("edges").notNull().default("[]"),
  evaluation: text("evaluation").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_workflows_owner_updated").on(table.ownerId, table.updatedAt)]);
