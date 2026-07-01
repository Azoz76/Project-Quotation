"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft, MapPin, FileText, FileImage, Calendar,
  DollarSign, ClipboardList, Cpu, HardHat, ExternalLink,
  Upload, ChevronDown, ChevronUp, Loader2, Trash2,
  RefreshCw, SendHorizonal, Sparkles, CheckCircle2, Download,
} from "lucide-react";

type UploadRecord = {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  public_url: string;
  storage_path: string;
  category: string;
  created_at: string;
};

type BOQItem = { item: string; qty: number; unit: string; unit_price: number; total: number };
type MaterialItem = { name: string; cost: number };

type Quotation = {
  id: string;
  total_cost: number | null;
  engineer_price: number | null;
  estimated_completion: string | null;
  bill_of_quantity: BOQItem[] | null;
  ai_analysis: string | null;
  materials: MaterialItem[] | null;
  status: string;
  created_at: string;
};

type Project = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  location_address: string | null;
  map_url: string | null;
  status: string;
  created_at: string;
  uploads: UploadRecord[];
  quotations: Quotation[];
};

const MAX_SIZE = 10 * 1024 * 1024;

const UPLOAD_SECTIONS = [
  { key: "drawing"  as const, label: "Engineering Drawings", accept: ".pdf,.dwg,.dxf",                        hint: "PDF, DWG, DXF" },
  { key: "permit"   as const, label: "Building Permits",     accept: ".pdf",                                   hint: "PDF only" },
  { key: "document" as const, label: "Additional Documents", accept: ".pdf,.docx,.jpg,.jpeg,.png,.webp",       hint: "PDF, DOCX, JPG, PNG, WebP" },
];

const statusColors: Record<string, string> = {
  draft:       "bg-gray-100 text-gray-600",
  reviewing:   "bg-blue-100 text-blue-700",
  quoted:      "bg-orange-100 text-orange-700",
  accepted:    "bg-green-100 text-green-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  completed:   "bg-primary/10 text-primary",
};

const statusLabels: Record<string, string> = {
  draft:       "Draft",
  reviewing:   "Reviewing for Pricing",
  quoted:      "Quoted",
  accepted:    "Accepted",
  in_progress: "In Progress",
  completed:   "Completed",
};

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "KWD", minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n);
}

function formatBytes(b: number) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(2) + " MB";
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  // Upload panel
  const [showUpload, setShowUpload] = useState(false);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");

  // Per-file actions
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [replacingUpload, setReplacingUpload] = useState<UploadRecord | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);

  // Role detection
  const [isAdmin, setIsAdmin] = useState(false);

  // Admin AI pricing
  const [generatingAi, setGeneratingAi] = useState(false);
  const [approvingAi, setApprovingAi]   = useState(false);
  const [aiError, setAiError]           = useState("");

  // BOQ collapse
  const [showBOQ, setShowBOQ] = useState(true);

  // Submit to admin
  const [submitting, setSubmitting] = useState(false);
  // True whenever the client adds/replaces files in this session — causes
  // the Submit button to reappear even if status is already "reviewing"
  const [newFilesAdded, setNewFilesAdded] = useState(false);

  const addRefs = {
    drawing:  useRef<HTMLInputElement>(null),
    permit:   useRef<HTMLInputElement>(null),
    document: useRef<HTMLInputElement>(null),
  };
  const replaceRef = useRef<HTMLInputElement>(null);

  async function load() {
    const supabase = createClient();
    const [{ data }, { data: { user } }] = await Promise.all([
      supabase
        .from("projects")
        .select(`
          id, user_id, title, description, location_address, map_url, status, created_at,
          uploads(id, file_name, file_type, file_size, public_url, storage_path, category, created_at),
          quotations(id, total_cost, engineer_price, estimated_completion, bill_of_quantity, ai_analysis, materials, status, created_at)
        `)
        .eq("id", id)
        .single(),
      supabase.auth.getUser(),
    ]);
    setProject(data as unknown as Project);
    if (user) {
      const { data: u } = await supabase.from("users").select("role").eq("id", user.id).single();
      setIsAdmin(u?.role === "admin");
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!id) return;
    load();
    const supabase = createClient();
    const channel = supabase
      .channel(`project-detail-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects",   filter: `id=eq.${id}` },          load)
      .on("postgres_changes", { event: "*", schema: "public", table: "quotations", filter: `project_id=eq.${id}` },  load)
      .on("postgres_changes", { event: "*", schema: "public", table: "uploads",    filter: `project_id=eq.${id}` },  load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Add files ────────────────────────────────────────────────────────────────
  async function handleAddFiles(
    e: React.ChangeEvent<HTMLInputElement>,
    category: "drawing" | "permit" | "document",
  ) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploadError("");

    const oversized = files.filter(f => f.size > MAX_SIZE);
    if (oversized.length) {
      setUploadError(`File too large (max 10 MB): ${oversized.map(f => f.name).join(", ")}`);
      e.target.value = "";
      return;
    }

    setUploadingCategory(category);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploadError("Not authenticated."); setUploadingCategory(null); return; }

    const errors: string[] = [];
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${id}/${Date.now()}-${safeName}`;
      const { error: storageErr } = await supabase.storage.from("uploads").upload(path, file);
      if (storageErr) { errors.push(`${file.name}: ${storageErr.message}`); continue; }
      const { data: { publicUrl } } = supabase.storage.from("uploads").getPublicUrl(path);
      const { error: dbErr } = await supabase.from("uploads").insert({
        project_id: id, user_id: user.id,
        file_name: file.name, file_type: file.type || "application/octet-stream",
        file_size: file.size, storage_path: path, public_url: publicUrl, category,
      });
      if (dbErr) errors.push(`${file.name} (DB): ${dbErr.message}`);
    }

    if (errors.length) setUploadError(errors.join("\n"));
    else setNewFilesAdded(true);
    e.target.value = "";
    setUploadingCategory(null);
    await load();
  }

  // ── Delete file ───────────────────────────────────────────────────────────────
  async function deleteFile(upload: UploadRecord) {
    if (!confirm(`Delete "${upload.file_name}"?`)) return;
    setDeletingId(upload.id);
    const supabase = createClient();
    if (upload.storage_path) {
      await supabase.storage.from("uploads").remove([upload.storage_path]);
    }
    await supabase.from("uploads").delete().eq("id", upload.id);
    setDeletingId(null);
    await load();
  }

  // ── Replace file ──────────────────────────────────────────────────────────────
  function startReplace(upload: UploadRecord) {
    setReplacingUpload(upload);
    replaceRef.current?.click();
  }

  async function handleReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !replacingUpload) return;
    e.target.value = "";

    if (file.size > MAX_SIZE) {
      setUploadError(`"${file.name}" is too large (max 10 MB).`);
      setReplacingUpload(null);
      return;
    }

    setReplacingId(replacingUpload.id);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setReplacingUpload(null); setReplacingId(null); return; }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const newPath = `${user.id}/${id}/${Date.now()}-${safeName}`;

    const { error: storageErr } = await supabase.storage.from("uploads").upload(newPath, file);
    if (storageErr) {
      setUploadError(`Replace failed: ${storageErr.message}`);
      setReplacingId(null); setReplacingUpload(null);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("uploads").getPublicUrl(newPath);

    // Update DB record to point to new file
    await supabase.from("uploads").update({
      file_name: file.name,
      file_type: file.type || "application/octet-stream",
      file_size: file.size,
      storage_path: newPath,
      public_url: publicUrl,
    }).eq("id", replacingUpload.id);

    // Delete old file from storage
    if (replacingUpload.storage_path) {
      await supabase.storage.from("uploads").remove([replacingUpload.storage_path]);
    }

    setReplacingId(null);
    setReplacingUpload(null);
    setUploadError("");
    setNewFilesAdded(true);
    await load();
  }

  // ── Submit to admin ───────────────────────────────────────────────────────────
  async function submitToAdmin() {
    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !project) { setSubmitting(false); return; }

    // Set project back to "reviewing" so admin sees it in review queue
    await supabase.from("projects").update({ status: "reviewing" as "draft" }).eq("id", project.id);

    // Notify the client themselves (confirmation)
    await supabase.from("notifications").insert({
      user_id: user.id,
      message: `Your updated documents for "${project.title}" have been submitted for admin review.`,
      link: `/dashboard/projects/${project.id}`,
    });

    setSubmitting(false);
    setNewFilesAdded(false);
    await load();
  }

  // ── Admin: Generate AI Pricing ────────────────────────────────────────────────
  async function generateAiPricing() {
    if (!project) return;
    setGeneratingAi(true);
    setAiError("");
    try {
      const res = await fetch("/api/quotation/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id }),
      });
      const data = await res.json();
      if (!res.ok) { setAiError(data.error ?? "AI generation failed"); return; }

      const supabase = createClient();
      const existing = project.quotations?.[0];
      if (existing) {
        await supabase.from("quotations").update({
          total_cost: data.total_cost,
          ai_analysis: data.ai_analysis,
          bill_of_quantity: data.bill_of_quantity,
          estimated_completion: data.estimated_completion ?? null,
          status: "generated",
        }).eq("id", existing.id);
      } else {
        await supabase.from("quotations").insert({
          project_id: id,
          user_id: project.user_id,
          total_cost: data.total_cost,
          ai_analysis: data.ai_analysis,
          bill_of_quantity: data.bill_of_quantity,
          estimated_completion: data.estimated_completion ?? null,
          status: "generated",
        });
      }
      await load();
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setGeneratingAi(false);
    }
  }

  // ── Admin: Approve & Send to Client ──────────────────────────────────────────
  async function approveAndSend() {
    if (!project) return;
    setApprovingAi(true);
    const supabase = createClient();
    const existing = project.quotations?.[0];
    if (!existing) { setApprovingAi(false); return; }

    await supabase.from("quotations").update({ status: "approved" }).eq("id", existing.id);
    await supabase.from("projects").update({ status: "quoted" }).eq("id", project.id);
    await supabase.from("notifications").insert({
      user_id: project.user_id,
      message: `Pricing is ready for your project "${project.title}"! Click to view the quotation.`,
      link: `/dashboard/projects/${project.id}`,
    });
    setApprovingAi(false);
    await load();
  }

  // ── Download BOQ as Excel-compatible CSV ─────────────────────────────────────
  function downloadBOQ() {
    if (!project || boqItems.length === 0) return;
    const grandTotal = boqItems.reduce((s, i) => s + i.total, 0);
    const rows: (string | number)[][] = [
      [`Bill of Quantity — ${project.title}`],
      [`Location: ${project.location_address ?? ""}`, "", "", "", ""],
      [`Generated: ${new Date().toLocaleDateString("en-GB")}`],
      [],
      ["Item", "Qty", "Unit", "Unit Price (KWD)", "Total (KWD)"],
      ...boqItems.map(r => [r.item, r.qty, r.unit, r.unit_price, r.total]),
      [],
      ["Grand Total", "", "", "", grandTotal],
    ];
    const csv = rows
      .map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    // BOM ensures Excel opens UTF-8 correctly (handles Arabic text)
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `BOQ-${project.title.replace(/[^a-zA-Z0-9]/g, "_")}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="text-text-muted">Loading project...</div>;
  if (!project) return <div className="text-red-500">Project not found.</div>;

  const q = project.quotations?.[0] ?? null;
  const approvedQ = q?.status === "approved" ? q : null;
  // Admins preview pricing at any status; clients only see approved pricing
  const displayQ = isAdmin ? q : approvedQ;
  const drawings = project.uploads?.filter(u => u.category === "drawing")  ?? [];
  const permits  = project.uploads?.filter(u => u.category === "permit")   ?? [];
  const docs     = project.uploads?.filter(u => !["drawing", "permit"].includes(u.category)) ?? [];
  const boqItems: BOQItem[] = Array.isArray(displayQ?.bill_of_quantity) ? (displayQ!.bill_of_quantity as BOQItem[]) : [];
  const materialsItems: MaterialItem[] = Array.isArray(displayQ?.materials) ? (displayQ!.materials as MaterialItem[]) : [];
  const hasFiles = project.uploads?.length > 0;

  // ── File row component ────────────────────────────────────────────────────────
  function FileRow({ f }: { f: UploadRecord }) {
    const isDeleting  = deletingId  === f.id;
    const isReplacing = replacingId === f.id;
    const busy = isDeleting || isReplacing;
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-surface rounded-lg group">
        <a href={f.public_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
          {f.file_type.startsWith("image/") ? (
            <FileImage className="h-4 w-4 text-accent shrink-0" />
          ) : (
            <FileText className="h-4 w-4 text-accent shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary group-hover:text-accent transition-colors truncate">{f.file_name}</p>
            <p className="text-xs text-text-muted">{formatBytes(f.file_size)}</p>
          </div>
        </a>

        <div className="flex items-center gap-1.5 ml-3 shrink-0">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
          ) : (
            <>
              {/* Replace */}
              <button
                onClick={() => startReplace(f)}
                title="Replace file"
                className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              {/* Delete */}
              <button
                onClick={() => deleteFile(f)}
                title="Delete file"
                className="p-1.5 rounded-lg text-text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              {/* Open */}
              <a href={f.public_url} target="_blank" rel="noopener noreferrer"
                title="Open file"
                className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Hidden replace input */}
      <input
        ref={replaceRef}
        type="file"
        accept=".pdf,.dwg,.dxf,.docx,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleReplace}
      />

      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/dashboard/projects"
          className="mt-1 p-1.5 rounded-lg hover:bg-surface text-text-muted hover:text-primary transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-primary">{project.title}</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[project.status] ?? ""}`}>
              {statusLabels[project.status] ?? project.status}
            </span>
          </div>
          <p className="text-sm text-text-muted mt-1">Submitted {formatDate(project.created_at)}</p>
        </div>
      </div>

      {/* Pricing Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Cpu,           label: "AI Pricing",      value: displayQ?.total_cost != null      ? fmt(displayQ.total_cost)      : null, color: "text-primary" },
          { icon: HardHat,       label: "Engineer Pricing", value: displayQ?.engineer_price != null  ? fmt(displayQ.engineer_price)  : null, color: "text-green-700" },
          { icon: Calendar,      label: "Est. Completion",  value: displayQ?.estimated_completion    ?? null,                                  color: "text-primary" },
          { icon: ClipboardList, label: "Bill of Qty",      value: boqItems.length > 0 ? `${boqItems.length} items` : null,                    color: "text-primary" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-4 w-4 text-accent" />
              <p className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</p>
            </div>
            <p className={`text-lg font-bold ${value ? color : "text-text-muted"}`}>{value ?? "Pending"}</p>
          </div>
        ))}
      </div>

      {/* Project Details */}
      <div className="bg-white rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-base font-semibold text-primary">Project Details</h2>
        {project.description && (
          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Description</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{project.description}</p>
          </div>
        )}
        {(project.location_address || project.map_url) && (
          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Location</p>
            {project.location_address && (
              <p className="text-sm text-foreground flex items-start gap-1.5">
                <MapPin className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                {project.location_address}
              </p>
            )}
            {project.map_url && (
              <a href={project.map_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-1 text-sm text-accent hover:underline">
                <ExternalLink className="h-3.5 w-3.5" /> View on Map
              </a>
            )}
          </div>
        )}
      </div>

      {/* AI Analysis */}
      {displayQ?.ai_analysis && (
        <div className="bg-white rounded-xl border border-border p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-accent" />
            <h2 className="text-base font-semibold text-primary">AI Analysis</h2>
            {isAdmin && q?.status !== "approved" && (
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                Admin Preview — Not visible to client yet
              </span>
            )}
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{displayQ.ai_analysis}</p>
        </div>
      )}

      {/* Bill of Quantity */}
      {boqItems.length > 0 && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {/* Header row */}
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-accent shrink-0" />
            <h2 className="text-base font-semibold text-primary flex-1">Bill of Quantity</h2>
            <span className="text-xs text-text-muted mr-2">{boqItems.length} items</span>
            {/* Download Excel */}
            <button
              onClick={downloadBOQ}
              title="Download as Excel (CSV)"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Excel
            </button>
            {/* Collapse / Expand */}
            <button
              onClick={() => setShowBOQ(v => !v)}
              title={showBOQ ? "Collapse" : "Expand"}
              className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-surface transition-colors"
            >
              {showBOQ ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
          {/* Collapsible table */}
          {showBOQ && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-text-muted">Item</th>
                    <th className="text-right px-5 py-3 font-medium text-text-muted">Qty</th>
                    <th className="text-left px-5 py-3 font-medium text-text-muted">Unit</th>
                    <th className="text-right px-5 py-3 font-medium text-text-muted">Unit Price</th>
                    <th className="text-right px-5 py-3 font-medium text-text-muted">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {boqItems.map((item, i) => (
                    <tr key={i} className="hover:bg-surface/50">
                      <td className="px-5 py-3">{item.item}</td>
                      <td className="px-5 py-3 text-right">{item.qty}</td>
                      <td className="px-5 py-3 text-text-muted">{item.unit}</td>
                      <td className="px-5 py-3 text-right">{fmt(item.unit_price)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-primary">{fmt(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-surface border-t-2 border-border">
                  <tr>
                    <td colSpan={4} className="px-5 py-3 font-semibold text-right text-primary">Grand Total</td>
                    <td className="px-5 py-3 font-bold text-right text-primary text-base">
                      {fmt(boqItems.reduce((s, i) => s + i.total, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Materials (legacy) */}
      {materialsItems.length > 0 && boqItems.length === 0 && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-accent" />
            <h2 className="text-base font-semibold text-primary">Materials Estimate</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-surface">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-text-muted">Material</th>
                <th className="text-right px-5 py-3 font-medium text-text-muted">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {materialsItems.map((m, i) => (
                <tr key={i}>
                  <td className="px-5 py-3">{m.name}</td>
                  <td className="px-5 py-3 text-right">{fmt(m.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Uploaded Files ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border p-6 space-y-5">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-primary">Uploaded Files</h2>
          <button
            onClick={() => { setShowUpload(v => !v); setUploadError(""); }}
            className="flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover font-medium transition-colors"
          >
            <Upload className="h-4 w-4" />
            Add Files
            {showUpload ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Upload panel */}
        {showUpload && (
          <div className="border border-dashed border-accent/40 rounded-xl p-4 space-y-4 bg-surface/30">
            <p className="text-xs text-text-muted">Select files to upload — they are saved immediately upon selection.</p>
            {uploadError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 whitespace-pre-wrap">
                {uploadError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {UPLOAD_SECTIONS.map(section => (
                <div key={section.key}>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">{section.label}</p>
                  <button
                    type="button"
                    onClick={() => addRefs[section.key].current?.click()}
                    disabled={uploadingCategory !== null}
                    className="w-full flex flex-col items-center justify-center h-24 border-2 border-dashed border-border rounded-lg hover:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingCategory === section.key
                      ? <Loader2 className="h-5 w-5 animate-spin text-accent" />
                      : <Upload className="h-5 w-5 text-text-muted mb-1" />
                    }
                    <span className="text-xs text-text-muted mt-1">
                      {uploadingCategory === section.key ? "Uploading…" : "Click to select"}
                    </span>
                    <span className="text-xs text-text-muted/70">{section.hint}</span>
                  </button>
                  <input
                    ref={addRefs[section.key]}
                    type="file"
                    accept={section.accept}
                    multiple
                    className="hidden"
                    onChange={e => handleAddFiles(e, section.key)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File groups */}
        {hasFiles ? (
          <>
            {[
              { label: "Engineering Drawings", files: drawings },
              { label: "Building Permits",     files: permits  },
              { label: "Additional Documents", files: docs     },
            ].filter(g => g.files.length > 0).map(group => (
              <div key={group.label}>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">{group.label}</p>
                <div className="space-y-2">
                  {group.files.map(f => <FileRow key={f.id} f={f} />)}
                </div>
              </div>
            ))}
          </>
        ) : (
          <p className="text-sm text-text-muted">No files uploaded yet. Use "Add Files" above.</p>
        )}

        {/* ── Action area ───────────────────────────────────────────────── */}
        <div className="pt-3 border-t border-border">
          {isAdmin ? (
            /* ── ADMIN: AI Pricing controls ─────────────────────────────── */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  AI Pricing
                </h3>
                {q && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    q.status === "approved"  ? "bg-green-100 text-green-700"  :
                    q.status === "generated" ? "bg-blue-100 text-blue-700"   :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {q.status === "approved" ? "Approved — Sent to client" :
                     q.status === "generated" ? "Generated — Pending approval" : q.status}
                  </span>
                )}
              </div>

              {q?.total_cost != null && (
                <div className="bg-surface rounded-lg px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-text-muted">AI Estimated Total</span>
                  <span className="font-bold text-primary text-xl">{fmt(q.total_cost)}</span>
                </div>
              )}

              {aiError && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{aiError}</p>
              )}

              {(!q || q.status === "rejected") && (
                <button
                  onClick={generateAiPricing}
                  disabled={generatingAi}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  {generatingAi
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Reading drawings &amp; calculating…</>
                    : <><Sparkles className="h-4 w-4" /> Generate AI Pricing</>
                  }
                </button>
              )}

              {q?.status === "generated" && (
                <div className="flex gap-2">
                  <button
                    onClick={approveAndSend}
                    disabled={approvingAi}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    {approvingAi
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Approving…</>
                      : <><CheckCircle2 className="h-4 w-4" /> Approve &amp; Send to Client</>
                    }
                  </button>
                  <button
                    onClick={generateAiPricing}
                    disabled={generatingAi}
                    title="Re-generate"
                    className="flex items-center justify-center gap-2 px-4 py-3 border border-border rounded-xl text-sm font-medium text-text-muted hover:text-primary hover:bg-surface disabled:opacity-60 transition-all"
                  >
                    {generatingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Re-generate
                  </button>
                </div>
              )}

              {q?.status === "approved" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Pricing approved and visible to client
                  </div>
                  <button
                    onClick={generateAiPricing}
                    disabled={generatingAi}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm text-text-muted hover:text-primary hover:bg-surface disabled:opacity-60 transition-all"
                  >
                    {generatingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Re-generate (will require re-approval)
                  </button>
                </div>
              )}
            </div>
          ) : hasFiles ? (
            /* ── CLIENT: Submit / Waiting ───────────────────────────────── */
            newFilesAdded ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Ready to send your documents?</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    Submit to notify our team to review your uploaded files.
                  </p>
                </div>
                <button
                  onClick={submitToAdmin}
                  disabled={submitting}
                  className="shrink-0 flex items-center gap-2 px-6 py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md active:scale-95"
                >
                  {submitting
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
                    : <><SendHorizonal className="h-4 w-4" /> Submit to Admin</>
                  }
                </button>
              </div>
            ) : project?.status === "reviewing" ? (
              <div className="flex items-center gap-4 px-5 py-4 bg-orange-50 border border-orange-200 rounded-xl">
                <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                  <div className="h-5 w-5 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-orange-800">Waiting for Pricing</p>
                  <p className="text-xs text-orange-700 mt-0.5">
                    Your documents are under review. We&apos;ll notify you as soon as pricing is ready.
                  </p>
                </div>
              </div>
            ) : null
          ) : null}
        </div>
      </div>
    </div>
  );
}
