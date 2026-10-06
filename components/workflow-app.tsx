"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, ArrowRight, Circle, Diamond, FilePlus2, FolderOpen, FolderPlus, Plus, Redo2, RefreshCw, Save, Search, Square, StickyNote, Undo2, X } from "lucide-react";

type Setting = "Inpatient" | "Outpatient";
type Shape = "start" | "process" | "decision" | "end" | "note";
type NodeItem = { id: string; shape: Shape; label: string; role: string; system: string; note: string; x: number; y: number };
type Edge = { id: string; from: string | null; to: string | null; direction: "one" | "two"; label: string; startX?: number; startY?: number; endX?: number; endY?: number };
type Project = { id: number; name: string; workflowCount: number };
type MirrorDimension = { id: string; name: string; side: "patient" | "clinician"; help: string };
type MirrorEvaluation = { scores: Record<string, { value?: number; evidence?: string }>; patientInterview: string; clinicianInterview: string; tradeoffs: { benefit: string; cost: string; check: string }[]; decision: string; confidence: string; redFlags: string; actions: { task: string; owner: string; due: string }[] };
type Workflow = { id?: number; projectId?: number | null; name: string; setting: Setting; workflowType: string; department: string; state: string; nodes: NodeItem[]; edges: Edge[]; evaluation: MirrorEvaluation };

const inventory: Record<Setting, Record<string, string[]>> = {
  Inpatient: {
    "Admission & placement": ["Admission and bed assignment", "Patient arrival and initial nursing assessment"],
    "Medication management": ["Admission medication reconciliation", "Medication ordering and pharmacy verification", "Medication administration", "Discharge medication reconciliation"],
    "Clinical documentation": ["Provider admission history and physical", "Nursing assessment and flowsheet documentation", "Daily progress note and care plan update"],
    Diagnostics: ["Laboratory ordering and specimen collection", "Imaging ordering and completion", "Results review and critical result communication"],
    "Coordination & handoffs": ["Shift handoff", "Interdisciplinary rounds", "Consultation request and response", "Unit transfer and handoff"],
    "Procedures & escalation": ["Procedure preparation and consent", "Recognition of deterioration and escalation"],
    "Discharge & transitions": ["Discharge planning and post-acute coordination", "Discharge orders, education, and departure"],
  },
  Outpatient: {
    "Access & scheduling": ["New-patient intake", "Appointment scheduling and rescheduling", "Referral intake and scheduling"],
    "Before the visit": ["Insurance verification and registration", "Previsit planning and chart preparation"],
    "Arrival & rooming": ["Check-in", "Rooming, vital signs, and screening", "Medication and allergy reconciliation"],
    "Clinical encounter": ["Provider assessment and documentation", "Diagnosis and order entry", "Telehealth visit"],
    "Medications & treatments": ["Prescription ordering", "Refill request processing", "Immunization or office treatment administration"],
    "Diagnostics & results": ["Laboratory or imaging ordering", "Results review and patient notification"],
    "Between visits": ["Telephone or portal-message triage", "Prior authorization", "Outgoing referral and referral-loop closure"],
    "Checkout & follow-up": ["After-visit instructions, checkout, and follow-up scheduling"],
  },
};

const labels: Record<Shape, string> = { start: "Start event", process: "Task", decision: "Gateway", end: "End event", note: "Text annotation" };

const mirrorDimensions: MirrorDimension[] = [
  { id: "effort", name: "Effort", side: "patient", help: "Time, steps, repetition, and work imposed on patients or caregivers." },
  { id: "clarity", name: "Clarity", side: "patient", help: "Understanding of what is happening, what was decided, and what to do next." },
  { id: "trust", name: "Trust", side: "patient", help: "Transparency, privacy, ability to question or decline, and confidence in the process." },
  { id: "access", name: "Access", side: "patient", help: "Ability to enter and complete the workflow across language, disability, technology, time, and cost." },
  { id: "continuity", name: "Continuity", side: "patient", help: "Whether information, responsibility, and next steps survive handoffs and time." },
  { id: "cognitiveLoad", name: "Cognitive load", side: "clinician", help: "Attention, memory, task switching, information search, and verification required." },
  { id: "documentationTime", name: "Documentation time", side: "clinician", help: "Total time to create, review, correct, sign, and close documentation." },
  { id: "interruptions", name: "Interruption burden", side: "clinician", help: "Frequency, timing, severity, and recovery cost of interruptions and alerts." },
  { id: "autonomy", name: "Autonomy", side: "clinician", help: "Ability to understand, challenge, change, defer, or override system output." },
  { id: "recovery", name: "Recovery from errors", side: "clinician", help: "How reliably errors are detected, corrected, communicated, and contained." },
];

function blankEvaluation(): MirrorEvaluation {
  return { scores: {}, patientInterview: "", clinicianInterview: "", tradeoffs: [], decision: "", confidence: "", redFlags: "", actions: [] };
}

function fresh(setting: Setting, workflowType: string, projectId?: number): Workflow {
  return {
    projectId, name: workflowType, setting, workflowType, department: "", state: "Current state",
    evaluation: blankEvaluation(),
    nodes: [
      { id: "start", shape: "start", label: "Workflow begins", role: "", system: "", note: "", x: 50, y: 220 },
      { id: "step-1", shape: "process", label: "First task", role: "", system: "", note: "", x: 265, y: 218 },
    ],
    edges: [{ id: "edge-1", from: "start", to: "step-1", direction: "one", label: "" }],
  };
}

function normalize(workflow: Workflow): Workflow {
  const defaults = blankEvaluation();
  const savedEvaluation = workflow.evaluation || defaults;
  return {
    ...workflow,
    evaluation: {
      ...defaults,
      ...savedEvaluation,
      scores: savedEvaluation.scores && typeof savedEvaluation.scores === "object" ? savedEvaluation.scores : {},
      tradeoffs: Array.isArray(savedEvaluation.tradeoffs) ? savedEvaluation.tradeoffs : [],
      actions: Array.isArray(savedEvaluation.actions) ? savedEvaluation.actions : [],
    },
    nodes: workflow.nodes.map((node) => ({ ...node, shape: node.shape === ("issue" as Shape) ? "note" : node.shape })),
  };
}

function ToolbarIcon({ shape }: { shape: Shape }) {
  if (shape === "decision") return <Diamond size={18}/>;
  if (shape === "process") return <Square size={18}/>;
  if (shape === "note") return <StickyNote size={18}/>;
  return <Circle size={18} strokeWidth={shape === "end" ? 3 : 2}/>;
}

function MirrorScoreCard({ dimension, value, onChange }: { dimension: MirrorDimension; value: { value?: number; evidence?: string }; onChange: (value: { value?: number; evidence?: string }) => void }) {
  return <article className="mirror-score-card">
    <div className="mirror-score-copy"><strong>{dimension.name}</strong><span>{dimension.help}</span></div>
    <div className="mirror-score-options" role="group" aria-label={`${dimension.name} score`}>
      {[1, 2, 3, 4, 5].map((score) => <button type="button" key={score} aria-pressed={value.value === score} onClick={() => onChange({ ...value, value: score })}>{score}</button>)}
    </div>
    <label className="mirror-evidence"><span>Observed evidence</span><input value={value.evidence || ""} onChange={(event) => onChange({ ...value, evidence: event.target.value })} placeholder="Example, measure, or affected group" /></label>
  </article>;
}

function geometry(node: NodeItem) {
  if (node.shape === "process" || node.shape === "note") return { cx: node.x + 85, cy: node.y + 36, rx: 85, ry: 36 };
  if (node.shape === "decision") return { cx: node.x + 65, cy: node.y + 34, rx: 48, ry: 48 };
  return { cx: node.x + 65, cy: node.y + 34, rx: 34, ry: 34 };
}

function boundaryRadius(node: NodeItem, ux: number, uy: number) {
  const box = geometry(node), ax = Math.max(Math.abs(ux), 0.0001), ay = Math.max(Math.abs(uy), 0.0001);
  if (node.shape === "process" || node.shape === "note") return Math.min(box.rx / ax, box.ry / ay);
  if (node.shape === "decision") return 1 / (ax / box.rx + ay / box.ry);
  return box.rx;
}

function connector(a: NodeItem, b: NodeItem) {
  const p = geometry(a), q = geometry(b);
  const dx = q.cx - p.cx || 1, dy = q.cy - p.cy;
  const length = Math.hypot(dx, dy); const ux = dx / length, uy = dy / length;
  const ar = boundaryRadius(a, ux, uy), br = boundaryRadius(b, ux, uy);
  const arrowClearance = 14;
  return { x1: p.cx + ux * (ar + 2), y1: p.cy + uy * (ar + 2), x2: q.cx - ux * (br + arrowClearance), y2: q.cy - uy * (br + arrowClearance) };
}

function openConnector(edge: Edge, nodes: NodeItem[]) {
  const source = edge.from ? nodes.find((node) => node.id === edge.from) : undefined;
  const target = edge.to ? nodes.find((node) => node.id === edge.to) : undefined;
  if (source && target) return connector(source, target);
  const sourceBox = source ? geometry(source) : null;
  const targetBox = target ? geometry(target) : null;
  const rawX1 = sourceBox?.cx ?? edge.startX ?? ((edge.endX ?? 360) - 190);
  const rawY1 = sourceBox?.cy ?? edge.startY ?? edge.endY ?? 210;
  const rawX2 = targetBox?.cx ?? edge.endX ?? (rawX1 + 190);
  const rawY2 = targetBox?.cy ?? edge.endY ?? rawY1;
  const dx = rawX2 - rawX1 || 1, dy = rawY2 - rawY1;
  const length = Math.hypot(dx, dy), ux = dx / length, uy = dy / length;
  const sourceRadius = source ? boundaryRadius(source, ux, uy) + 2 : 0;
  const targetRadius = target ? boundaryRadius(target, ux, uy) + 14 : 0;
  return { x1: rawX1 + ux * sourceRadius, y1: rawY1 + uy * sourceRadius, x2: rawX2 - ux * targetRadius, y2: rawY2 - uy * targetRadius };
}

function arrowHead(tipX: number, tipY: number, tailX: number, tailY: number) {
  const angle = Math.atan2(tipY - tailY, tipX - tailX);
  const length = 13, width = 6;
  const baseX = tipX - Math.cos(angle) * length, baseY = tipY - Math.sin(angle) * length;
  const sideX = Math.sin(angle) * width, sideY = -Math.cos(angle) * width;
  return `${tipX},${tipY} ${baseX + sideX},${baseY + sideY} ${baseX - sideX},${baseY - sideY}`;
}

function snapshot(workflow: Workflow): Workflow { return JSON.parse(JSON.stringify(workflow)); }

export default function WorkflowApp() {
  const [setting, setSetting] = useState<Setting>("Inpatient");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<"projects" | "library" | "editor">("projects");
  const [editorView, setEditorView] = useState<"map" | "mirror">("map");
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectStatus, setProjectStatus] = useState("");
  const [workflow, setWorkflow] = useState<Workflow>(() => fresh("Inpatient", "Admission and bed assignment"));
  const [selectedNode, setSelectedNode] = useState("step-1");
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [connectorMode, setConnectorMode] = useState<{ direction: "one" | "two"; from: string | null } | null>(null);
  const [past, setPast] = useState<Workflow[]>([]);
  const [future, setFuture] = useState<Workflow[]>([]);
  const [saved, setSaved] = useState<Workflow[]>([]);
  const [status, setStatus] = useState("Not saved");
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const drag = useRef<{ id: string; dx: number; dy: number; before: Workflow } | null>(null);
  const edgeDrag = useRef<{ id: string; pointerX: number; pointerY: number; line: { x1: number; y1: number; x2: number; y2: number }; before: Workflow; moved: boolean } | null>(null);
  const canvasRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/projects"), fetch("/api/workflows")]).then(async ([projectResponse, workflowResponse]) => {
      const projectData = projectResponse.ok ? await projectResponse.json() : [];
      const workflowData = workflowResponse.ok ? await workflowResponse.json() : [];
      if (Array.isArray(projectData)) setProjects(projectData);
      if (Array.isArray(workflowData)) setSaved(workflowData.map(normalize));
    }).catch(() => setProjectStatus("Projects are temporarily unavailable."));
  }, []);
  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: object, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: object) => { try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(console.warn); } catch (error) { console.warn(error); } };
    register({ name: "list_workflow_types", title: "List workflow types", description: "List the built-in inpatient and outpatient workflow types.", inputSchema: { type: "object", properties: { setting: { type: "string", enum: ["Inpatient", "Outpatient"] } }, required: ["setting"], additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute(input: unknown) { const value = input as { setting?: Setting }; if (!value.setting || !inventory[value.setting]) throw new Error("setting must be Inpatient or Outpatient"); return { setting: value.setting, workflowTypes: Object.values(inventory[value.setting]).flat() }; } });
    register({ name: "start_workflow_capture", title: "Start workflow capture", description: "Open an unsaved BPMN workflow draft in the currently selected project.", inputSchema: { type: "object", properties: { setting: { type: "string", enum: ["Inpatient", "Outpatient"] }, workflowType: { type: "string", minLength: 1, maxLength: 160 } }, required: ["setting", "workflowType"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute(input: unknown) { const value = input as { setting?: Setting; workflowType?: string }; if (!activeProject) throw new Error("Choose a project first"); if (!value.setting || !inventory[value.setting] || !value.workflowType?.trim()) throw new Error("Provide a valid setting and workflowType"); openDraft(fresh(value.setting, value.workflowType.trim(), activeProject.id)); return { status: "draft_opened", project: activeProject.name, setting: value.setting, workflowType: value.workflowType.trim() }; } });
    return () => lifecycle.abort();
  // Re-register so the browser tool always targets the project currently open in the UI.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject]);

  const options = useMemo(() => Object.entries(inventory[setting]).map(([group, items]) => ({ group, items: items.filter((item) => item.toLowerCase().includes(search.toLowerCase())) })).filter((group) => group.items.length), [setting, search]);
  const projectWorkflows = useMemo(() => activeProject ? saved.filter((item) => item.projectId === activeProject.id) : [], [activeProject, saved]);
  const activeNode = workflow.nodes.find((node) => node.id === selectedNode);
  const activeEdge = workflow.edges.find((edge) => edge.id === selectedEdge);
  const boardWidth = Math.max(1200, ...workflow.nodes.map((node) => node.x + 360), ...workflow.edges.flatMap((edge) => [(edge.startX ?? 0) + 180, (edge.endX ?? 0) + 180]));
  const boardHeight = Math.max(700, ...workflow.nodes.map((node) => node.y + 240), ...workflow.edges.flatMap((edge) => [(edge.startY ?? 0) + 160, (edge.endY ?? 0) + 160]));

  function chooseProject(project: Project) { setActiveProject(project); setStage("library"); setSearch(""); }
  async function createProject() {
    const name = projectName.trim();
    if (!name) return setProjectStatus("Add a project name.");
    setProjectStatus("Creating…");
    try {
      const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const project = await response.json();
      if (!response.ok) throw new Error(project.error || "create failed");
      setProjects((items) => [project, ...items.filter((item) => item.id !== project.id)]);
      setProjectName(""); setProjectStatus(""); chooseProject(project);
    } catch { setProjectStatus("We couldn't create this project."); }
  }
  function openDraft(next: Workflow, savedStatus = "Not saved") {
    const clean = normalize({ ...next, projectId: activeProject?.id ?? next.projectId }); setWorkflow(clean); setSetting(clean.setting); setSelectedNode(clean.nodes[0]?.id || ""); setSelectedEdge(null); setConnectorMode(null); setPast([]); setFuture([]); setStatus(savedStatus); setEditorView("map"); setStage("editor");
  }
  function commit(next: Workflow) { setPast((items) => [...items.slice(-49), snapshot(workflow)]); setFuture([]); setWorkflow(next); setStatus("Unsaved changes"); }
  function updateEvaluation(patch: Partial<MirrorEvaluation>) { commit({ ...workflow, evaluation: { ...workflow.evaluation, ...patch } }); }
  function undo() { const previous = past[past.length - 1]; if (!previous) return; setPast((items) => items.slice(0, -1)); setFuture((items) => [snapshot(workflow), ...items].slice(0, 50)); setWorkflow(previous); setStatus("Unsaved changes"); }
  function redo() { const next = future[0]; if (!next) return; setFuture((items) => items.slice(1)); setPast((items) => [...items, snapshot(workflow)].slice(-50)); setWorkflow(next); setStatus("Unsaved changes"); }
  function selectNode(id: string) { setSelectedNode(id); setSelectedEdge(null); }
  function selectEdge(id: string) { setSelectedEdge(id); setSelectedNode(""); setConnectorMode(null); }
  function updateNode(patch: Partial<NodeItem>) { if (!activeNode) return; commit({ ...workflow, nodes: workflow.nodes.map((node) => node.id === activeNode.id ? { ...node, ...patch } : node) }); }
  function updateEdge(patch: Partial<Edge>) { if (!activeEdge) return; commit({ ...workflow, edges: workflow.edges.map((edge) => edge.id === activeEdge.id ? { ...edge, ...patch } : edge) }); }
  function connectorButton(direction: "one" | "two") {
    if (activeEdge) { updateEdge({ direction }); return; }
    const source = selectedNode ? workflow.nodes.find((node) => node.id === selectedNode) : undefined;
    const canvas = canvasRef.current;
    const start = source ? geometry(source) : { cx: (canvas?.scrollLeft ?? 0) + 170, cy: (canvas?.scrollTop ?? 0) + 190 };
    const edge: Edge = { id: `edge-${Date.now()}`, from: source?.id ?? null, to: null, direction, label: "", startX: start.cx, startY: start.cy, endX: start.cx + 190, endY: start.cy };
    commit({ ...workflow, edges: [...workflow.edges, edge] });
    setSelectedEdge(edge.id); setSelectedNode(""); setConnectorMode(null);
    setStatus("Open connector added — add or tap a receiving shape");
  }
  function setDirection(direction: "one" | "two") { if (activeEdge) updateEdge({ direction }); }
  function reverseDirection() {
    if (!activeEdge) return;
    const line = openConnector(activeEdge, workflow.nodes);
    updateEdge({ from: activeEdge.to, to: activeEdge.from, startX: activeEdge.endX ?? line.x2, startY: activeEdge.endY ?? line.y2, endX: activeEdge.startX ?? line.x1, endY: activeEdge.startY ?? line.y1 });
    setStatus("Connector direction reversed");
  }
  function nodeClick(id: string) {
    if (activeEdge && !activeEdge.to) {
      if (activeEdge.from === id) { setStatus("Choose a different receiving shape"); return; }
      updateEdge({ to: id }); setStatus("Connector attached"); return;
    }
    if (!connectorMode) { selectNode(id); return; }
    if (!connectorMode.from) { setConnectorMode({ ...connectorMode, from: id }); selectNode(id); setStatus("Choose a destination shape"); return; }
    if (connectorMode.from === id) { setStatus("Choose a different destination shape"); return; }
    const edge: Edge = { id: `edge-${Date.now()}`, from: connectorMode.from, to: id, direction: connectorMode.direction, label: "" };
    commit({ ...workflow, edges: [...workflow.edges, edge] });
    setSelectedEdge(edge.id); setSelectedNode(""); setConnectorMode(null); setStatus("Connector added — add a Yes/No label if needed");
  }
  function addNode(shape: Shape) {
    const id = `node-${Date.now()}`; const last = workflow.nodes[workflow.nodes.length - 1];
    if (activeEdge && !activeEdge.to) {
      const width = shape === "process" || shape === "note" ? 170 : 130;
      const endX = activeEdge.endX ?? last.x + 310, endY = activeEdge.endY ?? last.y + 34;
      const node: NodeItem = { id, shape, label: labels[shape], role: "", system: "", note: "", x: Math.max(8, endX - width / 2), y: Math.max(10, endY - 34) };
      commit({ ...workflow, nodes: [...workflow.nodes, node], edges: workflow.edges.map((edge) => edge.id === activeEdge.id ? { ...edge, to: id } : edge) });
      selectNode(id); setStatus("Shape attached to connector"); return;
    }
    const node: NodeItem = { id, shape, label: labels[shape], role: "", system: "", note: "", x: last.x + 225, y: last.y };
    commit({ ...workflow, nodes: [...workflow.nodes, node], edges: [...workflow.edges, { id: `edge-${Date.now()}`, from: last.id, to: id, direction: "one", label: "" }] }); selectNode(id);
  }
  function removeSelection() {
    if (activeEdge) { commit({ ...workflow, edges: workflow.edges.filter((edge) => edge.id !== activeEdge.id) }); setSelectedEdge(null); return; }
    if (!activeNode || workflow.nodes.length === 1) return;
    const remaining = workflow.nodes.filter((node) => node.id !== activeNode.id);
    commit({ ...workflow, nodes: remaining, edges: workflow.edges.filter((edge) => edge.from !== activeNode.id && edge.to !== activeNode.id) });
    setSelectedNode(remaining[0]?.id || "");
  }
  async function save() {
    if (!activeProject) return setStatus("Choose a project");
    if (!workflow.name.trim()) return setStatus("Add a workflow name"); setStatus("Saving…");
    try { const response = await fetch("/api/workflows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...workflow, projectId: activeProject.id }) }); const data = normalize(await response.json()); if (!response.ok) throw new Error("save failed"); const isNew = !workflow.id; setWorkflow(data); setSaved((items) => [data, ...items.filter((item) => item.id !== data.id)]); if (isNew) { setProjects((items) => items.map((item) => item.id === activeProject.id ? { ...item, workflowCount: item.workflowCount + 1 } : item)); setActiveProject((item) => item ? { ...item, workflowCount: item.workflowCount + 1 } : item); } setStatus("Saved just now"); }
    catch { setStatus("Save failed — keep this tab open and retry"); }
  }
  function pointerDown(event: React.PointerEvent, node: NodeItem) { event.stopPropagation(); if (connectorMode || (activeEdge && !activeEdge.to)) return; selectNode(node.id); const canvas = canvasRef.current; if (!canvas) return; const box = canvas.getBoundingClientRect(); drag.current = { id: node.id, dx: event.clientX - box.left + canvas.scrollLeft - node.x, dy: event.clientY - box.top + canvas.scrollTop - node.y, before: snapshot(workflow) }; (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId); }
  function edgePointerDown(event: React.PointerEvent<SVGGElement>, edge: Edge, line: { x1: number; y1: number; x2: number; y2: number }) { event.stopPropagation(); selectEdge(edge.id); const canvas = canvasRef.current; if (!canvas) return; const box = canvas.getBoundingClientRect(); edgeDrag.current = { id: edge.id, pointerX: event.clientX - box.left + canvas.scrollLeft, pointerY: event.clientY - box.top + canvas.scrollTop, line, before: snapshot(workflow), moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }
  function pointerMove(event: React.PointerEvent) {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current, box = canvas.getBoundingClientRect();
    if (edgeDrag.current) {
      const current = edgeDrag.current, pointerX = event.clientX - box.left + canvas.scrollLeft, pointerY = event.clientY - box.top + canvas.scrollTop;
      const dx = pointerX - current.pointerX, dy = pointerY - current.pointerY;
      if (!current.moved && Math.hypot(dx, dy) < 3) return;
      current.moved = true;
      setWorkflow((value) => ({ ...value, edges: value.edges.map((edge) => edge.id === current.id ? { ...edge, from: null, to: null, startX: current.line.x1 + dx, startY: current.line.y1 + dy, endX: current.line.x2 + dx, endY: current.line.y2 + dy } : edge) }));
      setStatus("Connector moved independently"); return;
    }
    if (!drag.current) return;
    const current = drag.current;
    setWorkflow((value) => ({ ...value, nodes: value.nodes.map((node) => node.id === current.id ? { ...node, x: Math.max(8, event.clientX - box.left + canvas.scrollLeft - current.dx), y: Math.max(10, event.clientY - box.top + canvas.scrollTop - current.dy) } : node) })); setStatus("Unsaved changes");
  }
  function pointerUp() {
    if (edgeDrag.current) { const current = edgeDrag.current; edgeDrag.current = null; if (current.moved) { setPast((items) => [...items.slice(-49), current.before]); setFuture([]); } return; }
    if (!drag.current) return; const before = drag.current.before; drag.current = null; setPast((items) => [...items.slice(-49), before]); setFuture([]);
  }

  if (stage === "projects") return <main className="min-h-screen bg-[#f4f7fa] text-[#10233a]">
    <header className="border-b border-[#d7e0e8] bg-white px-6 py-4 lg:px-10"><div className="mx-auto flex max-w-6xl items-center gap-3"><span className="logo-mark"><ArrowLeftRight size={20}/></span><div><h1 className="text-lg font-bold tracking-tight">Workflow Capture + Mirror Test</h1><p className="text-sm text-[#617187]">Map the work. Review both sides of care.</p></div></div></header>
    <section className="mx-auto max-w-6xl px-6 py-10 lg:px-10"><div className="mb-8 max-w-2xl"><p className="eyebrow">Step 1 of 2</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Choose a project</h2><p className="mt-3 text-base text-[#617187]">Workflows are organized and saved inside a project.</p></div>
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px]"><section className="panel overflow-hidden"><div className="border-b border-[#dce4ea] p-5"><div className="flex items-center gap-2"><FolderOpen size={19}/><h3 className="font-bold">Your projects</h3></div><p className="mt-1 text-sm text-[#6b7a8e]">Select a project to view or add workflows.</p></div><div className="project-list">{projects.length ? projects.map((project) => <button type="button" className="project-row" key={project.id} onClick={() => chooseProject(project)}><span className="project-icon"><FolderOpen size={20}/></span><span className="min-w-0 flex-1"><strong>{project.name}</strong><small>{project.workflowCount} {project.workflowCount === 1 ? "workflow" : "workflows"}</small></span><ArrowRight size={18}/></button>) : <div className="empty"><FolderOpen size={28}/><p>No projects yet.</p><span>Create your first project to begin.</span></div>}</div></section>
        <aside className="panel h-fit p-5"><span className="project-create-icon"><FolderPlus size={22}/></span><h3 className="mt-4 text-lg font-bold">Create a new project</h3><p className="mt-2 text-sm text-[#6b7a8e]">Use a program, initiative, department, or implementation name.</p><label className="field mt-5"><span>Project name</span><input value={projectName} onChange={(event) => { setProjectName(event.target.value); setProjectStatus(""); }} onKeyDown={(event) => { if (event.key === "Enter") void createProject(); }} placeholder="e.g. Emergency Department Redesign"/></label><button type="button" className="primary mt-4 w-full" onClick={() => void createProject()}><Plus size={17}/> Create project</button>{projectStatus && <p className="mt-3 text-sm text-[#a14b43]">{projectStatus}</p>}</aside></div>
    </section>
  </main>;

  if (stage === "library") return <main className="min-h-screen bg-[#f4f7fa] text-[#10233a]">
    <header className="border-b border-[#d7e0e8] bg-white px-6 py-4 lg:px-10"><div className="mx-auto flex max-w-7xl items-center gap-3"><button type="button" className="icon-button mr-1" onClick={() => setStage("projects")} aria-label="Back to projects"><ArrowRight className="rotate-180" size={19}/></button><span className="logo-mark"><ArrowLeftRight size={20}/></span><div><h1 className="text-lg font-bold tracking-tight">{activeProject?.name}</h1><p className="text-sm text-[#617187]">Workflow Capture · Map and evaluate</p></div></div></header>
    <section className="mx-auto max-w-7xl px-6 py-10 lg:px-10"><div className="mb-8 max-w-2xl"><p className="eyebrow">Step 2 of 2 · {activeProject?.name}</p><h2 className="mt-2 text-3xl font-bold tracking-tight">What are you documenting today?</h2><p className="mt-3 text-base text-[#617187]">Choose a care setting, then select a common workflow or create your own.</p></div>
      <div className="mb-8 inline-flex rounded-xl border border-[#cbd6df] bg-white p-1 shadow-sm">{(["Inpatient", "Outpatient"] as Setting[]).map((item) => <button type="button" key={item} onClick={() => setSetting(item)} className={`setting-tab ${setting === item ? "active" : ""}`}>{item}</button>)}</div>
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px]"><section className="panel overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dce4ea] p-5"><div><h3 className="font-bold">{setting} workflow inventory</h3><p className="mt-1 text-sm text-[#6b7a8e]">{Object.values(inventory[setting]).flat().length} common workflows</p></div><button type="button" className="primary" onClick={() => setCustomOpen(true)}><Plus size={17}/> Create new</button></div><div className="border-b border-[#dce4ea] p-4"><label className="searchbox"><Search size={17}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search workflows"/></label></div><div className="max-h-[510px] overflow-y-auto p-4">{options.map(({ group, items }) => <div key={group} className="mb-6"><p className="group-label">{group}</p><div className="grid gap-2 sm:grid-cols-2">{items.map((item) => <button type="button" key={item} onClick={() => openDraft(fresh(setting, item, activeProject?.id))} className="workflow-choice"><span>{item}</span><ArrowRight size={17}/></button>)}</div></div>)}</div></section>
        <aside className="panel h-fit"><div className="flex items-center gap-2 border-b border-[#dce4ea] p-5"><FolderOpen size={19}/><div><h3 className="font-bold">Project workflows</h3><p className="mt-1 text-xs text-[#6b7a8e]">{activeProject?.name}</p></div></div><div className="p-4">{projectWorkflows.length ? projectWorkflows.slice(0, 8).map((item) => { const scored = Object.values(item.evaluation?.scores || {}).filter((score) => score.value).length; return <button type="button" className="saved-row" key={item.id} onClick={() => openDraft(item, "Saved")}><strong>{item.name}</strong><span>{item.setting} · {item.state} · {scored}/10 reviewed{item.evaluation?.decision ? ` · ${item.evaluation.decision}` : ""}</span></button>; }) : <div className="empty"><FilePlus2 size={28}/><p>No saved workflows yet.</p><span>Choose a workflow to start this project.</span></div>}</div></aside></div>
    </section>
    {customOpen && <div className="modal-backdrop" onMouseDown={() => setCustomOpen(false)}><div className="modal" onMouseDown={(event) => event.stopPropagation()}><button type="button" className="icon-button absolute right-4 top-4" onClick={() => setCustomOpen(false)} aria-label="Close"><X size={19}/></button><p className="eyebrow">{activeProject?.name} · {setting}</p><h3 className="mt-2 text-xl font-bold">Create a custom workflow</h3><label className="field mt-6"><span>Workflow type</span><input autoFocus value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="e.g. Stroke alert response" onKeyDown={(event) => { if (event.key === "Enter" && customName.trim()) { openDraft(fresh(setting, customName.trim(), activeProject?.id)); setCustomOpen(false); } }}/></label><button type="button" className="primary mt-5 w-full justify-center" onClick={() => { if (customName.trim()) { openDraft(fresh(setting, customName.trim(), activeProject?.id)); setCustomOpen(false); } }}>Create workflow</button></div></div>}
  </main>;

  return <main className="flex h-screen min-h-[720px] flex-col overflow-hidden bg-[#eef3f7] text-[#10233a]">
    <header className="editor-header"><button type="button" className="icon-button" onClick={() => setStage("library")} aria-label="Back to workflow library"><ArrowRight className="rotate-180" size={20}/></button><div className="min-w-0 flex-1"><input className="title-input" value={workflow.name} onChange={(event) => commit({ ...workflow, name: event.target.value })} aria-label="Workflow name"/><div className="mt-1 flex items-center gap-2 text-xs text-[#6b7a8e]"><span className="project-badge">{activeProject?.name}</span><span className="setting-badge">{workflow.setting}</span><span className="bpmn-badge">BPMN 2.0</span><span>{workflow.workflowType}</span><span>·</span><span>{status}</span></div></div><button type="button" className="secondary hidden sm:flex" onClick={undo} disabled={!past.length} aria-label="Undo"><Undo2 size={17}/></button><button type="button" className="secondary hidden sm:flex" onClick={redo} disabled={!future.length} aria-label="Redo"><Redo2 size={17}/></button><button type="button" className="primary" onClick={save}><Save size={17}/> Save</button></header>
    <nav className="editor-views" aria-label="Workflow workspace"><button type="button" aria-pressed={editorView === "map"} onClick={() => setEditorView("map")}>Workflow map <span>{workflow.nodes.length} steps</span></button><button type="button" aria-pressed={editorView === "mirror"} onClick={() => setEditorView("mirror")}>Patient + clinician review <span>{Object.values(workflow.evaluation.scores).filter((score) => score.value).length}/10 scored</span></button></nav>
    {editorView === "map" ? <><div className="toolstrip"><span className="mr-2 text-xs font-bold uppercase tracking-wider text-[#6b7a8e]">BPMN elements</span>{(["start", "process", "decision", "end", "note"] as Shape[]).map((shape) => <button type="button" key={shape} onClick={() => addNode(shape)} title={`Add ${labels[shape]}`}><ToolbarIcon shape={shape}/><span>{labels[shape]}</span></button>)}<span className="divider"/><button type="button" className={activeEdge?.direction === "one" ? "active-tool" : ""} onClick={() => connectorButton("one")} title={activeEdge ? "Make selected connector one-way" : "Add an open one-way connector"}><ArrowRight size={18}/><span>{activeEdge ? "Set one-way" : "Add one-way"}</span></button><button type="button" className={activeEdge?.direction === "two" ? "active-tool" : ""} onClick={() => connectorButton("two")} title={activeEdge ? "Make selected connector two-way" : "Add an open two-way connector"}><ArrowLeftRight size={18}/><span>{activeEdge ? "Set two-way" : "Add two-way"}</span></button><button type="button" disabled={!activeEdge} onClick={reverseDirection} title="Reverse the selected connector direction"><RefreshCw size={17}/><span>Reverse</span></button><span className="divider"/><button type="button" className={activeEdge?.label === "Yes" ? "active-tool label-tool" : "label-tool"} disabled={!activeEdge} onClick={() => updateEdge({ label: "Yes" })} title="Label selected connector Yes"><span>Yes</span></button><button type="button" className={activeEdge?.label === "No" ? "active-tool label-tool" : "label-tool"} disabled={!activeEdge} onClick={() => updateEdge({ label: "No" })} title="Label selected connector No"><span>No</span></button></div>
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_310px]"><section ref={canvasRef} className="canvas relative m-3 mr-0 overflow-auto rounded-2xl border border-[#ced9e2] bg-white max-lg:mr-3">
        <div className="canvas-board relative" style={{ width: boardWidth, height: boardHeight }} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onClick={() => { setSelectedEdge(null); setSelectedNode(""); }}>
          <div className="canvas-grid"/>
          <svg className="absolute inset-0 h-full w-full" aria-label="Workflow connectors">{workflow.edges.map((edge) => { const line = openConnector(edge, workflow.nodes); const chosen = edge.id === selectedEdge; const color = chosen ? "#087895" : "#667f93"; return <g key={edge.id} className="edge-hit" onPointerDown={(event) => edgePointerDown(event, edge, line)} onClick={(event) => { event.stopPropagation(); selectEdge(edge.id); }}><line {...line} stroke="transparent" strokeWidth="24"/><line {...line} className={chosen ? "edge-line selected" : "edge-line"}/><polygon points={arrowHead(line.x2, line.y2, line.x1, line.y1)} fill={color} className="edge-arrow"/>{edge.direction === "two" && <polygon points={arrowHead(line.x1, line.y1, line.x2, line.y2)} fill={color} className="edge-arrow"/>}{edge.label && <text x={(line.x1 + line.x2) / 2} y={(line.y1 + line.y2) / 2 - 8} textAnchor="middle" className="edge-label">{edge.label}</text>}</g>; })}</svg>
          {workflow.nodes.map((node) => <button type="button" key={node.id} onPointerDown={(event) => pointerDown(event, node)} onClick={(event) => { event.stopPropagation(); nodeClick(node.id); }} className={`flow-node ${node.shape} ${selectedNode === node.id ? "selected" : ""} ${connectorMode?.from === node.id ? "connector-source" : ""}`} style={{ left: node.x, top: node.y }} aria-label={`${labels[node.shape]}: ${node.label}`}><span className="node-symbol">{node.shape === "decision" && <span className="gateway-x">×</span>}</span><span className="node-label">{node.label}</span></button>)}
          <div className={activeEdge && !activeEdge.to ? "canvas-help connecting" : "canvas-help"}>{activeEdge && !activeEdge.to ? "Open connector — add a shape or tap an existing shape to attach it" : "Drag empty canvas to pan on a phone · Workflow expands to the right"}</div>
        </div>
      </section>
      <aside className="m-3 flex min-h-0 flex-col overflow-y-auto rounded-2xl border border-[#ced9e2] bg-white p-5"><p className="eyebrow">Details</p>{activeNode ? <><h3 className="mt-2 font-bold">{labels[activeNode.shape]}</h3><label className="field mt-5"><span>Label</span><textarea rows={3} value={activeNode.label} onChange={(event) => updateNode({ label: event.target.value })}/></label><label className="field mt-4"><span>Role</span><input value={activeNode.role} onChange={(event) => updateNode({ role: event.target.value })} placeholder="e.g. Registered nurse"/></label><label className="field mt-4"><span>System or tool</span><input value={activeNode.system} onChange={(event) => updateNode({ system: event.target.value })} placeholder="e.g. EHR, phone, paper"/></label><label className="field mt-4"><span>Observation</span><textarea rows={4} value={activeNode.note} onChange={(event) => updateNode({ note: event.target.value })} placeholder="Delay, workaround, question…"/></label><button type="button" className="danger mt-5" onClick={removeSelection}>Delete shape</button></> : activeEdge ? <><h3 className="mt-2 font-bold">Sequence flow</h3><p className="mt-2 text-sm text-[#6b7a8e]">Drag the connector to move it independently. Moving it detaches it from its shapes.</p><div className="mt-4"><span className="branch-heading">Quick branch label</span><div className="mt-2 grid grid-cols-3 gap-2"><button type="button" className={activeEdge.label === "Yes" ? "branch-chip active" : "branch-chip"} onClick={() => updateEdge({ label: "Yes" })}>Yes</button><button type="button" className={activeEdge.label === "No" ? "branch-chip active" : "branch-chip"} onClick={() => updateEdge({ label: "No" })}>No</button><button type="button" className={!activeEdge.label ? "branch-chip active" : "branch-chip"} onClick={() => updateEdge({ label: "" })}>Clear</button></div></div><label className="field mt-4"><span>Custom connector label</span><input value={activeEdge.label} onChange={(event) => updateEdge({ label: event.target.value })} placeholder="e.g. Escalate, Approved"/></label><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" className={activeEdge.direction === "one" ? "direction-card active" : "direction-card"} onClick={() => setDirection("one")}><ArrowRight size={18}/>One-way</button><button type="button" className={activeEdge.direction === "two" ? "direction-card active" : "direction-card"} onClick={() => setDirection("two")}><ArrowLeftRight size={18}/>Two-way</button></div><button type="button" className="direction-card mt-2 w-full" onClick={reverseDirection}><RefreshCw size={17}/>Reverse direction</button><button type="button" className="danger mt-5" onClick={removeSelection}>Delete connector</button></> : connectorMode ? <><h3 className="mt-2 font-bold">Add connector</h3><p className="mt-2 text-sm text-[#6b7a8e]">{connectorMode.from ? "Tap the destination shape. You can add several flows from the same gateway." : "Tap the source shape, then tap its destination."}</p></> : <p className="mt-3 text-sm text-[#6b7a8e]">Select a BPMN element or connector to edit it.</p>}<div className="mt-auto border-t border-[#dce4ea] pt-5"><label className="field"><span>Department or unit</span><input value={workflow.department} onChange={(event) => commit({ ...workflow, department: event.target.value })} placeholder="Optional"/></label><label className="field mt-4"><span>Workflow state</span><select value={workflow.state} onChange={(event) => commit({ ...workflow, state: event.target.value })}><option>Current state</option><option>Future state</option></select></label></div></aside></div></> : <section className="mirror-editor">
      <div className="mirror-content"><header className="mirror-intro"><div><p className="eyebrow">Patient-and-Clinician Mirror Test · {workflow.name}</p><h2>Review the workflow from both sides.</h2><p>Rate what you observed, leave evidence, and decide what should happen next.</p></div><span className="mirror-progress">{Object.values(workflow.evaluation.scores).filter((score) => score.value).length} of 10 scored</span></header>
        <div className="privacy-note"><strong>Protect privacy:</strong> Keep notes de-identified. Do not record patient names, dates of birth, record numbers, or other identifying details.</div>
        <div className="scale-note"><strong>Score guide:</strong> 1 = substantial burden or risk · 3 = adequate with limitations · 5 = reliable across expected variation. Leave a score blank when there is not enough evidence; add an example or measure for each score.</div>
        {(["patient", "clinician"] as const).map((side) => <section className="mirror-group" key={side}><div className="mirror-group-title"><span className={`mirror-dot ${side}`}/><div><h3>{side === "patient" ? "Patient experience" : "Clinician experience"}</h3><p>{side === "patient" ? "Effort · clarity · trust · access · continuity" : "Cognitive load · documentation time · interruptions · autonomy · error recovery"}</p></div></div><div className="mirror-score-list">{mirrorDimensions.filter((dimension) => dimension.side === side).map((dimension) => <MirrorScoreCard key={dimension.id} dimension={dimension} value={workflow.evaluation.scores[dimension.id] || {}} onChange={(value) => updateEvaluation({ scores: { ...workflow.evaluation.scores, [dimension.id]: value } })}/>)}</div></section>)}
        <section className="mirror-group"><div className="mirror-group-title"><span className="mirror-dot patient"/><div><h3>Interview notes</h3><p>Capture de-identified observations or short paraphrases.</p></div></div><div className="mirror-notes-grid"><label className="field"><span>Patient or caregiver</span><small>What took effort? What was clear or confusing? Could they question, correct, or decline a step? What happens next?</small><textarea rows={5} value={workflow.evaluation.patientInterview} onChange={(event) => updateEvaluation({ patientInterview: event.target.value })} placeholder="Notes from patient or caregiver interviews"/></label><label className="field"><span>Clinician or staff</span><small>Where did people search, verify, switch tasks, or work around the process? How are errors corrected?</small><textarea rows={5} value={workflow.evaluation.clinicianInterview} onChange={(event) => updateEvaluation({ clinicianInterview: event.target.value })} placeholder="Notes from clinician or staff interviews"/></label></div></section>
        <section className="mirror-group"><div className="mirror-group-title"><span className="mirror-dot clinician"/><div><h3>Tradeoffs and follow-up</h3><p>Note who benefited, where work moved, and what needs another look.</p></div><button type="button" className="secondary" onClick={() => updateEvaluation({ tradeoffs: [...workflow.evaluation.tradeoffs, { benefit: "", cost: "", check: "" }] })}>Add tradeoff</button></div><div className="mirror-repeat-list">{workflow.evaluation.tradeoffs.length ? workflow.evaluation.tradeoffs.map((tradeoff, index) => <div className="mirror-repeat-card" key={index}><label className="field"><span>Benefit / who benefits</span><input value={tradeoff.benefit} onChange={(event) => { const tradeoffs = [...workflow.evaluation.tradeoffs]; tradeoffs[index] = { ...tradeoff, benefit: event.target.value }; updateEvaluation({ tradeoffs }); }}/></label><label className="field"><span>Burden or risk that moved</span><input value={tradeoff.cost} onChange={(event) => { const tradeoffs = [...workflow.evaluation.tradeoffs]; tradeoffs[index] = { ...tradeoff, cost: event.target.value }; updateEvaluation({ tradeoffs }); }}/></label><label className="field"><span>What to check</span><input value={tradeoff.check} onChange={(event) => { const tradeoffs = [...workflow.evaluation.tradeoffs]; tradeoffs[index] = { ...tradeoff, check: event.target.value }; updateEvaluation({ tradeoffs }); }}/></label><button type="button" className="danger" onClick={() => updateEvaluation({ tradeoffs: workflow.evaluation.tradeoffs.filter((_, itemIndex) => itemIndex !== index) })}>Remove</button></div>) : <p className="mirror-empty">No tradeoffs recorded.</p>}</div></section>
        <section className="mirror-group"><div className="mirror-group-title"><span className="mirror-dot clinician"/><div><h3>Decision and actions</h3><p>A high average cannot cancel a serious access, safety, privacy, or trust issue.</p></div></div><div className="mirror-decision-grid"><label className="field"><span>Decision</span><select value={workflow.evaluation.decision} onChange={(event) => updateEvaluation({ decision: event.target.value })}><option value="">Choose…</option><option>Ready to expand</option><option>Continue a bounded pilot</option><option>Redesign or pause</option></select></label><label className="field"><span>Evidence confidence</span><select value={workflow.evaluation.confidence} onChange={(event) => updateEvaluation({ confidence: event.target.value })}><option value="">Choose…</option><option>Low</option><option>Medium</option><option>High</option></select></label><label className="field"><span>Safety, privacy, equity, or access concerns</span><textarea rows={3} value={workflow.evaluation.redFlags} onChange={(event) => updateEvaluation({ redFlags: event.target.value })} placeholder="What needs attention before expanding?"/></label><div className="field"><div className="mirror-action-heading"><span>Actions and owners</span><button type="button" className="secondary" onClick={() => updateEvaluation({ actions: [...workflow.evaluation.actions, { task: "", owner: "", due: "" }] })}>Add action</button></div>{workflow.evaluation.actions.map((action, index) => <div className="mirror-action-row" key={index}><input aria-label="Action" value={action.task} placeholder="Action or measure" onChange={(event) => { const actions = [...workflow.evaluation.actions]; actions[index] = { ...action, task: event.target.value }; updateEvaluation({ actions }); }}/><input aria-label="Owner" value={action.owner} placeholder="Owner" onChange={(event) => { const actions = [...workflow.evaluation.actions]; actions[index] = { ...action, owner: event.target.value }; updateEvaluation({ actions }); }}/><input aria-label="Due date" type="date" value={action.due} onChange={(event) => { const actions = [...workflow.evaluation.actions]; actions[index] = { ...action, due: event.target.value }; updateEvaluation({ actions }); }}/><button type="button" className="danger" aria-label="Remove action" onClick={() => updateEvaluation({ actions: workflow.evaluation.actions.filter((_, itemIndex) => itemIndex !== index) })}>Remove</button></div>)}{!workflow.evaluation.actions.length && <p className="mirror-empty">No follow-up actions.</p>}</div></div><div className="mirror-threshold">Suggested floor: all ten scores at least 3, no unresolved critical issue, and enough evidence for the risk. Keep any pilot within the groups and conditions you evaluated.</div></section>
      </div>
    </section>}
  </main>;
}
