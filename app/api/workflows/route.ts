import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../db";
import { projects, workflows } from "../../../db/schema";

export const dynamic = "force-dynamic";

function owner() {
  return "workflow-capture-shared";
}

export async function GET() {
  try {
    const rows = await getDb().select().from(workflows).where(eq(workflows.ownerId, owner())).orderBy(desc(workflows.updatedAt));
    return NextResponse.json(rows.map((row) => ({ ...row, nodes: JSON.parse(row.nodes), edges: JSON.parse(row.edges), evaluation: JSON.parse(row.evaluation || "{}") })));
  } catch {
    return NextResponse.json({ error: "Saved workflows are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ownerId = owner();
    const projectId = Number(body.projectId);
    const [project] = await getDb().select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId))).limit(1);
    if (!project) return NextResponse.json({ error: "Choose a valid project before saving." }, { status: 400 });
    const values = {
      ownerId,
      projectId: project.id,
      name: String(body.name || "Untitled workflow").slice(0, 120),
      setting: body.setting === "Outpatient" ? "Outpatient" : "Inpatient",
      workflowType: String(body.workflowType || "Custom workflow").slice(0, 160),
      department: String(body.department || "").slice(0, 120),
      state: body.state === "Future state" ? "Future state" : "Current state",
      nodes: JSON.stringify(Array.isArray(body.nodes) ? body.nodes : []),
      edges: JSON.stringify(Array.isArray(body.edges) ? body.edges : []),
      evaluation: JSON.stringify(body.evaluation && typeof body.evaluation === "object" ? body.evaluation : {}),
      updatedAt: new Date().toISOString(),
    };
    const [saved] = body.id
      ? await getDb().update(workflows).set(values).where(and(eq(workflows.id, Number(body.id)), eq(workflows.ownerId, ownerId))).returning()
      : await getDb().insert(workflows).values(values).returning();
    return NextResponse.json({ ...saved, nodes: JSON.parse(saved.nodes), edges: JSON.parse(saved.edges), evaluation: JSON.parse(saved.evaluation || "{}") });
  } catch {
    return NextResponse.json({ error: "We couldn't save this workflow. Your work is still on screen." }, { status: 500 });
  }
}
