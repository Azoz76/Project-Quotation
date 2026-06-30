"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { Plus, MapPin, FileText, ExternalLink } from "lucide-react";

type Quotation = {
  total_cost: number | null;
  engineer_price: number | null;
  estimated_completion: string | null;
  bill_of_quantity: unknown;
  ai_analysis: string | null;
  status: string;
};

type Project = {
  id: string;
  title: string;
  description: string | null;
  location_address: string | null;
  map_url: string | null;
  status: string;
  created_at: string;
  quotations: Quotation[];
};

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
  if (n == null) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(n);
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data } = await supabase
        .from("projects")
        .select(`
          id, title, description, location_address, map_url, status, created_at,
          quotations(total_cost, engineer_price, estimated_completion, bill_of_quantity, ai_analysis, status)
        `)
        .order("created_at", { ascending: false });
      setProjects((data as unknown as Project[]) ?? []);
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel("projects-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "quotations" }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) return <div className="text-text-muted">Loading projects...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">My Projects</h1>
        <Link
          href="/dashboard/projects/new"
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium text-sm"
        >
          <Plus className="h-4 w-4" />
          New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-border">
          <FileText className="mx-auto h-12 w-12 text-text-muted mb-3" />
          <p className="text-text-muted mb-4 font-medium">No projects submitted yet</p>
          <Link
            href="/dashboard/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Submit Your First Project
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-surface border-b border-border">
                <tr>
                  <th className="text-left px-5 py-3.5 font-semibold text-text-muted">Project</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-text-muted">Location</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-text-muted">Submitted</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-text-muted">Status</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-text-muted">AI Pricing</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-text-muted">Engineer Pricing</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-text-muted">Est. Completion</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-text-muted">Bill of Qty</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {projects.map((p) => {
                  const q = p.quotations?.[0] ?? null;
                  const approvedQ = q?.status === "approved" ? q : null;
                  const hasBOQ = approvedQ && approvedQ.bill_of_quantity != null;
                  return (
                    <tr key={p.id} className="hover:bg-surface/50 transition-colors">
                      {/* Project */}
                      <td className="px-5 py-4">
                        <p className="font-semibold text-primary leading-tight">{p.title}</p>
                        {p.description && (
                          <p className="text-xs text-text-muted mt-0.5 line-clamp-1 max-w-[200px]">{p.description}</p>
                        )}
                      </td>

                      {/* Location */}
                      <td className="px-5 py-4">
                        {p.location_address ? (
                          <div className="flex items-start gap-1.5 text-text-muted text-xs max-w-[160px]">
                            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent" />
                            <span className="line-clamp-2">{p.location_address}</span>
                          </div>
                        ) : p.map_url ? (
                          <a href={p.map_url} target="_blank" rel="noopener noreferrer"
                             className="text-xs text-accent hover:underline flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" /> View Map
                          </a>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </td>

                      {/* Submitted */}
                      <td className="px-5 py-4 text-text-muted text-xs whitespace-nowrap">
                        {formatDate(p.created_at)}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusColors[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {statusLabels[p.status] ?? p.status}
                        </span>
                      </td>

                      {/* AI Pricing */}
                      <td className="px-5 py-4">
                        {approvedQ && approvedQ.total_cost != null ? (
                          <span className="font-semibold text-primary">{fmt(approvedQ.total_cost)}</span>
                        ) : (
                          <span className="text-xs text-text-muted italic">Pending</span>
                        )}
                      </td>

                      {/* Engineer Pricing */}
                      <td className="px-5 py-4">
                        {approvedQ && approvedQ.engineer_price != null ? (
                          <span className="font-semibold text-green-700">{fmt(approvedQ.engineer_price)}</span>
                        ) : (
                          <span className="text-xs text-text-muted italic">Pending</span>
                        )}
                      </td>

                      {/* Estimated Completion */}
                      <td className="px-5 py-4 text-xs text-foreground whitespace-nowrap">
                        {approvedQ?.estimated_completion ?? <span className="text-text-muted italic">Pending</span>}
                      </td>

                      {/* Bill of Quantity */}
                      <td className="px-5 py-4">
                        {hasBOQ ? (
                          <Link href={`/dashboard/projects/${p.id}`}
                            className="inline-flex items-center gap-1 text-xs text-accent hover:underline font-medium">
                            <FileText className="h-3.5 w-3.5" /> View BOQ
                          </Link>
                        ) : (
                          <span className="text-xs text-text-muted italic">Pending</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <Link href={`/dashboard/projects/${p.id}`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:text-accent font-medium transition-colors">
                          Details <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
