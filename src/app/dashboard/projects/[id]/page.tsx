"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft, MapPin, FileText, FileImage, Calendar,
  DollarSign, ClipboardList, Cpu, HardHat, ExternalLink,
  Upload, X, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";

type Upload = {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  public_url: string;
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
  title: string;
  description: string | null;
  location_address: string | null;
  map_url: string | null;
  status: string;
  created_at: string;
  uploads: Upload[];
  quotations: Quotation[];
};

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const UPLOAD_SECTIONS = [
  { key: "drawing" as const, label: "Engineering Drawings", accept: ".pdf,.dwg,.dxf", hint: "PDF, DWG, DXF" },
  { key: "permit"  as const, label: "Building Permits",     accept: ".pdf",            hint: "PDF only" },
  { key: "document" as const, label: "Additional Documents", accept: ".pdf,.docx,.jpg,.jpeg,.png,.webp", hint: "PDF, DOCX, JPG, PNG, WebP" },
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

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");
  const refs = {
    drawing: useRef<HTMLInputElement>(null),
    permit:  useRef<HTMLInputElement>(null),
    document: useRef<HTMLInputElement>(null),
  };

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("projects")
      .select(`
        id, title, description, location_address, map_url, status, created_at,
        uploads(id, file_name, file_type, file_size, public_url, category, created_at),
        quotations(id, total_cost, engineer_price, estimated_completion, bill_of_quantity, ai_analysis, materials, status, created_at)
      `)
      .eq("id", id)
      .single();
    setProject(data as unknown as Project);
    setLoading(false);
  }

  useEffect(() => {
    if (!id) return;
    load();
    const supabase = createClient();
    const channel = supabase
      .channel(`project-detail-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects", filter: `id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "quotations", filter: `project_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "uploads", filter: `project_id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleFileUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    category: "drawing" | "permit" | "document"
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
      const path = `${user.id}/${id}/${Date.now()}-${file.name}`;
      const { error: storageError } = await supabase.storage.from("uploads").upload(path, file);
      if (storageError) {
        errors.push(`${file.name}: ${storageError.message}`);
        continue;
      }
      const { data: { publicUrl } } = supabase.storage.from("uploads").getPublicUrl(path);
      const { error: dbError } = await supabase.from("uploads").insert({
        project_id: id,
        user_id: user.id,
        file_name: file.name,
        file_type: file.type || "application/octet-stream",
        file_size: file.size,
        storage_path: path,
        public_url: publicUrl,
        category,
      });
      if (dbError) errors.push(`${file.name}: ${dbError.message}`);
    }

    if (errors.length) setUploadError(errors.join("\n"));
    e.target.value = "";
    setUploadingCategory(null);
    await load();
  }

  if (loading) return <div className="text-text-muted">Loading project...</div>;
  if (!project) return <div className="text-red-500">Project not found.</div>;

  const q = project.quotations?.[0] ?? null;
  const approvedQ = q?.status === "approved" ? q : null;
  const drawings = project.uploads?.filter(u => u.category === "drawing") ?? [];
  const permits  = project.uploads?.filter(u => u.category === "permit")  ?? [];
  const docs     = project.uploads?.filter(u => !["drawing", "permit"].includes(u.category)) ?? [];
  const boqItems: BOQItem[] = Array.isArray(approvedQ?.bill_of_quantity) ? (approvedQ!.bill_of_quantity as BOQItem[]) : [];
  const materialsItems: MaterialItem[] = Array.isArray(approvedQ?.materials) ? (approvedQ!.materials as MaterialItem[]) : [];

  return (
    <div className="max-w-4xl space-y-6">
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
          { icon: Cpu,          label: "AI Pricing",      value: approvedQ?.total_cost != null ? fmt(approvedQ.total_cost) : null,           color: "text-primary" },
          { icon: HardHat,      label: "Engineer Pricing", value: approvedQ?.engineer_price != null ? fmt(approvedQ.engineer_price) : null,   color: "text-green-700" },
          { icon: Calendar,     label: "Est. Completion",  value: approvedQ?.estimated_completion ?? null,                                    color: "text-primary" },
          { icon: ClipboardList, label: "Bill of Qty",     value: boqItems.length > 0 ? `${boqItems.length} items` : null,                   color: "text-primary" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-4 w-4 text-accent" />
              <p className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</p>
            </div>
            <p className={`text-lg font-bold ${value ? color : "text-text-muted"}`}>
              {value ?? "Pending"}
            </p>
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
      {approvedQ?.ai_analysis && (
        <div className="bg-white rounded-xl border border-border p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-accent" />
            <h2 className="text-base font-semibold text-primary">AI Analysis</h2>
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{approvedQ.ai_analysis}</p>
        </div>
      )}

      {/* Bill of Quantity */}
      {boqItems.length > 0 && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-accent" />
            <h2 className="text-base font-semibold text-primary">Bill of Quantity</h2>
          </div>
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

      {/* Uploaded Files + Add More */}
      <div className="bg-white rounded-xl border border-border p-6 space-y-5">
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
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 whitespace-pre-wrap">
                <X className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                {uploadError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {UPLOAD_SECTIONS.map(section => (
                <div key={section.key}>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">{section.label}</p>
                  <button
                    type="button"
                    onClick={() => refs[section.key].current?.click()}
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
                    ref={refs[section.key]}
                    type="file"
                    accept={section.accept}
                    multiple
                    className="hidden"
                    onChange={e => handleFileUpload(e, section.key)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File list */}
        {project.uploads?.length > 0 ? (
          <>
            {[
              { label: "Engineering Drawings", files: drawings },
              { label: "Building Permits",     files: permits },
              { label: "Additional Documents", files: docs },
            ].filter(g => g.files.length > 0).map(group => (
              <div key={group.label}>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">{group.label}</p>
                <div className="space-y-2">
                  {group.files.map(f => (
                    <a key={f.id} href={f.public_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between px-4 py-3 bg-surface rounded-lg hover:bg-surface-alt transition-colors group">
                      <div className="flex items-center gap-3">
                        {f.file_type.startsWith("image/") ? (
                          <FileImage className="h-4 w-4 text-accent shrink-0" />
                        ) : (
                          <FileText className="h-4 w-4 text-accent shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-primary group-hover:text-accent transition-colors">{f.file_name}</p>
                          <p className="text-xs text-text-muted">{formatBytes(f.file_size)}</p>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-text-muted group-hover:text-accent transition-colors shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : (
          <p className="text-sm text-text-muted">No files uploaded yet. Use the button above to add files.</p>
        )}
      </div>
    </div>
  );
}
