"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  ChevronDown, ChevronUp, MapPin, ExternalLink, Share2,
  FileText, FileImage, CheckCircle, XCircle, Loader2,
  DollarSign, Edit2, Check, X,
} from "lucide-react";

type Upload = {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  public_url: string;
  category: string;
};

type Quotation = {
  id: string;
  total_cost: number | null;
  engineer_price: number | null;
  estimated_completion: string | null;
  bill_of_quantity: unknown;
  ai_analysis: string | null;
  status: string;
};

type Project = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: string;
  location_address: string | null;
  map_url: string | null;
  created_at: string;
  users: { full_name: string | null; email: string } | null;
  uploads: Upload[];
  quotations: Quotation[];
};

const STATUS_OPTIONS = [
  { value: "reviewing", label: "Reviewing" },
  { value: "quoted", label: "Quoted" },
  { value: "accepted", label: "Accepted" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  reviewing: "bg-blue-100 text-blue-700",
  quoted: "bg-orange-100 text-orange-700",
  accepted: "bg-green-100 text-green-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  completed: "bg-primary/10 text-primary",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  reviewing: "Reviewing for Pricing",
  quoted: "Quoted",
  accepted: "Accepted",
  in_progress: "In Progress",
  completed: "Completed",
};

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(n);
}

function formatBytes(b: number) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(2) + " MB";
}

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  // AI pricing edit state per project
  const [aiEdit, setAiEdit] = useState<Record<string, { amount: string; analysis: string }>>({});
  const [editingAi, setEditingAi] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("projects")
      .select(`
        id, user_id, title, description, status, location_address, map_url, created_at,
        users(full_name, email),
        uploads(id, file_name, file_type, file_size, public_url, category),
        quotations(id, total_cost, engineer_price, estimated_completion, bill_of_quantity, ai_analysis, status)
      `)
      .order("created_at", { ascending: false });
    if (!error) setProjects((data as unknown as Project[]) ?? []);
    setLoading(false);
  }

  async function updateStatus(projectId: string, newStatus: string) {
    setUpdatingId(projectId);
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({ status: newStatus as "reviewing" })
      .eq("id", projectId);
    if (!error) await load();
    setUpdatingId(null);
  }

  async function approveAiPricing(project: Project) {
    const q = project.quotations?.[0];
    if (!q) return;
    setUpdatingId(project.id);
    const supabase = createClient();
    await supabase.from("quotations").update({ status: "approved" }).eq("id", q.id);
    // Move project to "quoted" so the client sees it
    await supabase.from("projects").update({ status: "quoted" as "reviewing" }).eq("id", project.id);
    await load();
    setUpdatingId(null);
  }

  async function rejectAiPricing(project: Project) {
    const q = project.quotations?.[0];
    if (!q) return;
    setUpdatingId(project.id);
    const supabase = createClient();
    await supabase.from("quotations").update({ status: "rejected" }).eq("id", q.id);
    await load();
    setUpdatingId(null);
  }

  async function saveAiPricing(project: Project) {
    const edit = aiEdit[project.id];
    if (!edit) return;
    const amount = parseFloat(edit.amount);
    if (isNaN(amount)) return;
    setUpdatingId(project.id);
    const supabase = createClient();
    const q = project.quotations?.[0];
    if (q) {
      await supabase.from("quotations").update({
        total_cost: amount,
        ai_analysis: edit.analysis || null,
        status: "generated",
      }).eq("id", q.id);
    } else {
      await supabase.from("quotations").insert({
        project_id: project.id,
        user_id: project.user_id,
        total_cost: amount,
        ai_analysis: edit.analysis || null,
        status: "generated",
      });
    }
    setEditingAi(null);
    setAiEdit(prev => { const n = { ...prev }; delete n[project.id]; return n; });
    await load();
    setUpdatingId(null);
  }

  function startEditAi(project: Project) {
    const q = project.quotations?.[0];
    setAiEdit(prev => ({
      ...prev,
      [project.id]: {
        amount: q?.total_cost != null ? String(q.total_cost) : "",
        analysis: q?.ai_analysis ?? "",
      },
    }));
    setEditingAi(project.id);
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function shareLocation(project: Project) {
    const text = [project.title, project.location_address, project.map_url].filter(Boolean).join("\n");
    if (navigator.share) {
      navigator.share({ title: project.title, text, url: project.map_url ?? undefined });
    } else {
      navigator.clipboard.writeText(text);
      alert("Location copied to clipboard!");
    }
  }

  const filtered = filter === "all" ? projects : projects.filter(p => p.status === filter);
  const reviewingCount = projects.filter(p => p.status === "reviewing").length;

  if (loading) return <div className="text-text-muted">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">
          Client Projects
          {reviewingCount > 0 && (
            <span className="ml-3 px-2.5 py-0.5 bg-blue-100 text-blue-700 text-sm rounded-full font-medium">
              {reviewingCount} pending review
            </span>
          )}
        </h1>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { value: "all", label: `All (${projects.length})` },
          { value: "reviewing", label: `Reviewing (${projects.filter(p => p.status === "reviewing").length})` },
          { value: "quoted", label: `Quoted (${projects.filter(p => p.status === "quoted").length})` },
          { value: "accepted", label: `Accepted (${projects.filter(p => p.status === "accepted").length})` },
          { value: "in_progress", label: `In Progress (${projects.filter(p => p.status === "in_progress").length})` },
          { value: "completed", label: `Completed (${projects.filter(p => p.status === "completed").length})` },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.value
                ? "bg-primary text-white"
                : "bg-white border border-border text-text-muted hover:text-primary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-text-muted">Project</th>
                <th className="text-left px-5 py-3 font-semibold text-text-muted">Description</th>
                <th className="text-left px-5 py-3 font-semibold text-text-muted">Client</th>
                <th className="text-left px-5 py-3 font-semibold text-text-muted">Address</th>
                <th className="text-left px-5 py-3 font-semibold text-text-muted">Map</th>
                <th className="text-left px-5 py-3 font-semibold text-text-muted">Files</th>
                <th className="text-left px-5 py-3 font-semibold text-text-muted">Submitted</th>
                <th className="text-left px-5 py-3 font-semibold text-text-muted">Status</th>
                <th className="text-left px-5 py-3 font-semibold text-text-muted">AI Pricing</th>
                <th className="text-left px-5 py-3 font-semibold text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-8 text-center text-text-muted">No projects found</td>
                </tr>
              ) : (
                filtered.map(p => {
                  const q = p.quotations?.[0] ?? null;
                  const isExpanded = expanded.has(p.id);
                  const isUpdating = updatingId === p.id;
                  const drawings = p.uploads?.filter(u => u.category === "drawing") ?? [];
                  const permits = p.uploads?.filter(u => u.category === "permit") ?? [];
                  const docs = p.uploads?.filter(u => !["drawing", "permit"].includes(u.category)) ?? [];
                  const totalFiles = p.uploads?.length ?? 0;

                  // AI pricing status
                  const aiStatus = !q || q.total_cost == null
                    ? "none"
                    : q.status === "approved"
                    ? "approved"
                    : q.status === "rejected"
                    ? "rejected"
                    : "pending";

                  return (
                    <>
                      {/* Main row */}
                      <tr key={p.id} className="border-b border-surface-alt hover:bg-surface/30 transition-colors">
                        {/* Project title */}
                        <td className="px-5 py-3">
                          <Link href={`/dashboard/projects/${p.id}`}
                            className="font-semibold text-primary hover:text-accent text-sm">
                            {p.title}
                          </Link>
                        </td>

                        {/* Description */}
                        <td className="px-5 py-3 max-w-[180px]">
                          {p.description ? (
                            <p className="text-xs text-text-muted line-clamp-2">{p.description}</p>
                          ) : (
                            <span className="text-text-muted text-xs">—</span>
                          )}
                        </td>

                        {/* Client */}
                        <td className="px-5 py-3">
                          <p className="text-sm font-medium text-foreground">{p.users?.full_name ?? "—"}</p>
                          <p className="text-xs text-text-muted">{p.users?.email ?? ""}</p>
                        </td>

                        {/* Address (text only) */}
                        <td className="px-5 py-3 max-w-[160px]">
                          {p.location_address ? (
                            <div className="flex items-start gap-1 text-xs text-text-muted">
                              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent" />
                              <span className="line-clamp-2">{p.location_address}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-text-muted">—</span>
                          )}
                        </td>

                        {/* Map URL (separate column) */}
                        <td className="px-5 py-3">
                          {p.map_url ? (
                            <div className="flex items-center gap-2">
                              <a href={p.map_url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-accent hover:underline font-medium">
                                <ExternalLink className="h-3.5 w-3.5" /> Open
                              </a>
                              <button onClick={() => shareLocation(p)}
                                title="Share location"
                                className="p-1 rounded hover:bg-surface text-text-muted hover:text-accent transition-colors">
                                <Share2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-text-muted">—</span>
                          )}
                        </td>

                        {/* Files */}
                        <td className="px-5 py-3">
                          {totalFiles > 0 ? (
                            <div className="flex flex-col gap-0.5">
                              {drawings.length > 0 && (
                                <span className="text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded w-fit">
                                  {drawings.length} drawing{drawings.length > 1 ? "s" : ""}
                                </span>
                              )}
                              {permits.length > 0 && (
                                <span className="text-xs text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded w-fit">
                                  {permits.length} permit{permits.length > 1 ? "s" : ""}
                                </span>
                              )}
                              {docs.length > 0 && (
                                <span className="text-xs text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded w-fit">
                                  {docs.length} doc{docs.length > 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-text-muted">—</span>
                          )}
                        </td>

                        {/* Submitted */}
                        <td className="px-5 py-3 text-xs text-text-muted whitespace-nowrap">
                          {formatDate(p.created_at)}
                        </td>

                        {/* Status badge */}
                        <td className="px-5 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusColors[p.status] ?? ""}`}>
                            {statusLabels[p.status] ?? p.status}
                          </span>
                        </td>

                        {/* AI Pricing */}
                        <td className="px-5 py-3">
                          {aiStatus === "approved" && (
                            <div>
                              <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 w-fit">
                                <CheckCircle className="h-3 w-3" /> Approved
                              </span>
                              <p className="text-xs font-semibold text-primary mt-0.5">{fmt(q?.total_cost)}</p>
                            </div>
                          )}
                          {aiStatus === "rejected" && (
                            <span className="text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 w-fit">
                              <XCircle className="h-3 w-3" /> Rejected
                            </span>
                          )}
                          {aiStatus === "pending" && (
                            <div>
                              <span className="text-xs text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full font-medium">Pending Review</span>
                              <p className="text-xs font-semibold text-primary mt-0.5">{fmt(q?.total_cost)}</p>
                            </div>
                          )}
                          {aiStatus === "none" && (
                            <span className="text-xs text-text-muted italic">Not set</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            {/* Status dropdown */}
                            <div className="relative">
                              {isUpdating ? (
                                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                              ) : (
                                <select
                                  value={p.status}
                                  onChange={e => updateStatus(p.id, e.target.value)}
                                  className="text-xs border border-border rounded px-2 py-1.5 focus:ring-1 focus:ring-accent outline-none bg-white cursor-pointer"
                                >
                                  {STATUS_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                            {/* Expand toggle */}
                            <button
                              onClick={() => toggleExpand(p.id)}
                              className="p-1.5 rounded-lg hover:bg-surface text-text-muted hover:text-primary transition-colors"
                              title={isExpanded ? "Collapse" : "Expand details"}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded detail panel */}
                      {isExpanded && (
                        <tr key={`${p.id}-expanded`} className="bg-surface/40 border-b border-border">
                          <td colSpan={10} className="px-5 py-5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                              {/* Column 1: Files */}
                              <div>
                                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
                                  Uploaded Files
                                </h4>
                                {totalFiles === 0 ? (
                                  <p className="text-xs text-text-muted">No files uploaded</p>
                                ) : (
                                  <div className="space-y-3">
                                    {[
                                      { label: "Engineering Drawings", files: drawings, color: "text-blue-700" },
                                      { label: "Building Permits", files: permits, color: "text-orange-700" },
                                      { label: "Additional Documents", files: docs, color: "text-gray-700" },
                                    ].filter(g => g.files.length > 0).map(group => (
                                      <div key={group.label}>
                                        <p className={`text-xs font-semibold mb-1.5 ${group.color}`}>{group.label}</p>
                                        <div className="space-y-1">
                                          {group.files.map(f => (
                                            <a key={f.id} href={f.public_url} target="_blank" rel="noopener noreferrer"
                                              className="flex items-center gap-2 px-2.5 py-1.5 bg-white rounded-lg border border-border hover:border-accent transition-colors group">
                                              {f.file_type.startsWith("image/") ? (
                                                <FileImage className="h-3.5 w-3.5 text-accent shrink-0" />
                                              ) : (
                                                <FileText className="h-3.5 w-3.5 text-accent shrink-0" />
                                              )}
                                              <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium text-primary group-hover:text-accent truncate">{f.file_name}</p>
                                                <p className="text-xs text-text-muted">{formatBytes(f.file_size)}</p>
                                              </div>
                                              <ExternalLink className="h-3 w-3 text-text-muted group-hover:text-accent shrink-0" />
                                            </a>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Column 2: Location details */}
                              <div>
                                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
                                  Location Details
                                </h4>
                                {p.location_address && (
                                  <div className="mb-3">
                                    <p className="text-xs font-semibold text-text-muted mb-1">Address</p>
                                    <p className="text-sm text-foreground flex items-start gap-1.5">
                                      <MapPin className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                                      {p.location_address}
                                    </p>
                                  </div>
                                )}
                                {p.map_url && (
                                  <div>
                                    <p className="text-xs font-semibold text-text-muted mb-1">Map Link</p>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <a href={p.map_url} target="_blank" rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline font-medium">
                                        <ExternalLink className="h-3.5 w-3.5" /> Open Map
                                      </a>
                                      <button onClick={() => shareLocation(p)}
                                        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-accent font-medium transition-colors">
                                        <Share2 className="h-3.5 w-3.5" /> Share Location
                                      </button>
                                    </div>
                                    <p className="mt-1 text-xs text-text-muted break-all">{p.map_url}</p>
                                  </div>
                                )}
                                {!p.location_address && !p.map_url && (
                                  <p className="text-xs text-text-muted">No location provided</p>
                                )}
                                {p.description && (
                                  <div className="mt-4">
                                    <p className="text-xs font-semibold text-text-muted mb-1">Description</p>
                                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{p.description}</p>
                                  </div>
                                )}
                              </div>

                              {/* Column 3: AI Pricing Review */}
                              <div>
                                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
                                  AI Pricing Review
                                </h4>

                                {editingAi === p.id ? (
                                  <div className="space-y-3">
                                    <div>
                                      <label className="text-xs font-medium text-text-muted">Amount (SAR)</label>
                                      <input
                                        type="number"
                                        value={aiEdit[p.id]?.amount ?? ""}
                                        onChange={e => setAiEdit(prev => ({ ...prev, [p.id]: { ...prev[p.id], amount: e.target.value } }))}
                                        placeholder="e.g. 150000"
                                        className="mt-1 w-full text-sm px-3 py-2 border border-border rounded-lg focus:ring-1 focus:ring-accent outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-medium text-text-muted">AI Analysis / Notes</label>
                                      <textarea
                                        value={aiEdit[p.id]?.analysis ?? ""}
                                        onChange={e => setAiEdit(prev => ({ ...prev, [p.id]: { ...prev[p.id], analysis: e.target.value } }))}
                                        rows={3}
                                        placeholder="Add AI analysis or notes..."
                                        className="mt-1 w-full text-sm px-3 py-2 border border-border rounded-lg focus:ring-1 focus:ring-accent outline-none resize-none"
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => saveAiPricing(p)}
                                        disabled={isUpdating}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent-hover disabled:opacity-50"
                                      >
                                        <Check className="h-3.5 w-3.5" /> Save
                                      </button>
                                      <button
                                        onClick={() => setEditingAi(null)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-text-muted hover:text-primary"
                                      >
                                        <X className="h-3.5 w-3.5" /> Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    {q?.total_cost != null ? (
                                      <>
                                        <div className="bg-white rounded-lg border border-border p-3">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-text-muted font-medium">AI Price</span>
                                            <button onClick={() => startEditAi(p)}
                                              className="text-text-muted hover:text-accent">
                                              <Edit2 className="h-3.5 w-3.5" />
                                            </button>
                                          </div>
                                          <p className="text-lg font-bold text-primary">{fmt(q.total_cost)}</p>
                                          {q.ai_analysis && (
                                            <p className="text-xs text-text-muted mt-1 line-clamp-2">{q.ai_analysis}</p>
                                          )}
                                          <div className="mt-1">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                              q.status === "approved" ? "bg-green-100 text-green-700" :
                                              q.status === "rejected" ? "bg-red-100 text-red-700" :
                                              "bg-orange-100 text-orange-700"
                                            }`}>
                                              {q.status === "approved" ? "Approved — Visible to Client" :
                                               q.status === "rejected" ? "Rejected" :
                                               "Pending Admin Review"}
                                            </span>
                                          </div>
                                        </div>

                                        {q.status !== "approved" && q.status !== "rejected" && (
                                          <div className="flex gap-2">
                                            <button
                                              onClick={() => approveAiPricing(p)}
                                              disabled={isUpdating}
                                              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                                            >
                                              {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                              Approve & Send to Client
                                            </button>
                                            <button
                                              onClick={() => rejectAiPricing(p)}
                                              disabled={isUpdating}
                                              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
                                            >
                                              <XCircle className="h-3.5 w-3.5" /> Reject
                                            </button>
                                          </div>
                                        )}

                                        {q.status === "approved" && (
                                          <div className="flex gap-2">
                                            <button
                                              onClick={() => startEditAi(p)}
                                              className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-border rounded-lg text-xs font-medium text-text-muted hover:text-primary"
                                            >
                                              <Edit2 className="h-3.5 w-3.5" /> Edit Pricing
                                            </button>
                                          </div>
                                        )}

                                        {q.status === "rejected" && (
                                          <button
                                            onClick={() => startEditAi(p)}
                                            className="w-full flex items-center justify-center gap-1.5 py-2 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent-hover"
                                          >
                                            <Edit2 className="h-3.5 w-3.5" /> Revise Pricing
                                          </button>
                                        )}
                                      </>
                                    ) : (
                                      <div className="text-center py-4">
                                        <DollarSign className="h-8 w-8 text-text-muted mx-auto mb-2" />
                                        <p className="text-xs text-text-muted mb-3">No AI pricing set yet</p>
                                        <button
                                          onClick={() => startEditAi(p)}
                                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent-hover"
                                        >
                                          <Edit2 className="h-3.5 w-3.5" /> Set AI Pricing
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
