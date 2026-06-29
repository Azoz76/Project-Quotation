"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

type Project = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  location_address: string | null;
  created_at: string;
  users: { full_name: string | null; email: string } | null;
};

const statusColors: Record<string, string> = {
  draft: "bg-surface-alt text-text-muted",
  reviewing: "bg-blue-100 text-blue-700",
  quoted: "bg-accent/10 text-accent",
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

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("projects")
      .select("id, title, description, status, location_address, created_at, users(full_name, email)")
      .order("created_at", { ascending: false });
    setProjects((data as unknown as Project[]) ?? []);
    setLoading(false);
  }

  async function updateStatus(projectId: string, newStatus: string) {
    const supabase = createClient();
    await supabase.from("projects").update({ status: newStatus as "reviewing" }).eq("id", projectId);
    load();
  }

  const filtered = filter === "all" ? projects : projects.filter((p) => p.status === filter);
  const reviewingCount = projects.filter((p) => p.status === "reviewing").length;

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

      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { value: "all", label: `All (${projects.length})` },
          { value: "reviewing", label: `Reviewing (${projects.filter((p) => p.status === "reviewing").length})` },
          { value: "quoted", label: `Quoted (${projects.filter((p) => p.status === "quoted").length})` },
          { value: "accepted", label: `Accepted (${projects.filter((p) => p.status === "accepted").length})` },
          { value: "in_progress", label: `In Progress (${projects.filter((p) => p.status === "in_progress").length})` },
          { value: "completed", label: `Completed (${projects.filter((p) => p.status === "completed").length})` },
        ].map((f) => (
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
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-text-muted">Project</th>
              <th className="text-left px-5 py-3 font-medium text-text-muted">Client</th>
              <th className="text-left px-5 py-3 font-medium text-text-muted">Location</th>
              <th className="text-left px-5 py-3 font-medium text-text-muted">Submitted</th>
              <th className="text-left px-5 py-3 font-medium text-text-muted">Status</th>
              <th className="text-right px-5 py-3 font-medium text-text-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-text-muted">
                  No projects found
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="border-b border-surface-alt hover:bg-surface/50">
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/projects/${p.id}`} className="font-medium text-primary hover:text-accent">
                      {p.title}
                    </Link>
                    {p.description && (
                      <p className="text-xs text-text-muted line-clamp-1 mt-0.5">{p.description}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-foreground">
                    {p.users?.full_name ?? p.users?.email ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-text-muted text-xs">{p.location_address ?? "—"}</td>
                  <td className="px-5 py-3 text-text-muted">{formatDate(p.created_at)}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[p.status] ?? ""}`}>
                      {statusLabels[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <select
                      value={p.status}
                      onChange={(e) => updateStatus(p.id, e.target.value)}
                      className="text-xs border border-border rounded px-2 py-1 focus:ring-1 focus:ring-accent outline-none"
                    >
                      <option value="reviewing">Reviewing</option>
                      <option value="quoted">Quoted</option>
                      <option value="accepted">Accepted</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
