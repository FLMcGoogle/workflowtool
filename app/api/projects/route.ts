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
    const ownerId = owner();
    const [projectRows, workflowRows] = await Promise.all([
      getDb().select().from(projects).where(eq(projects.ownerId, ownerId)).orderBy(desc(projects.updatedAt)),
      getDb().select({ projectId: workflows.projectId }).from(workflows).where(eq(workflows.ownerId, ownerId)),
    ]);
    return NextResponse.json(projectRows.map((project) => ({
      ...project,
      workflowCount: workflowRows.filter((workflow) => workflow.projectId === project.id).length,
    })));
  } catch {
    return NextResponse.json({ error: "Projects are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ownerId = owner();
    const body = await request.json();
    const name = String(body.name || "").trim().slice(0, 120);
    if (!name) return NextResponse.json({ error: "Add a project name." }, { status: 400 });
    const [existing] = await getDb().select().from(projects).where(and(eq(projects.ownerId, ownerId), eq(projects.name, name))).limit(1);
    if (existing) return NextResponse.json(existing);
    const [project] = await getDb().insert(projects).values({ ownerId, name, updatedAt: new Date().toISOString() }).returning();
    return NextResponse.json({ ...project, workflowCount: 0 });
  } catch {
    return NextResponse.json({ error: "We couldn't create this project." }, { status: 500 });
  }
}
