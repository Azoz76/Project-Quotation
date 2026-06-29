"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";

type Project = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
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

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data } = await supabase
        .from("projects")
        .select("id, title, description, status, created_at")
        .order("created_at", { ascending: false });
      setProjects(data ?? []);
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel("projects")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) return <div className="text-text-muted">Loading projects...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">Projects</h1>
        <Link
          href="/dashboard/projects/new"
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium"
        >
          <Plus className="h-4 w-4" />
          New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-border">
          <p className="text-text-muted mb-4">No projects yet</p>
          <Link
            href="/dashboard/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" />
            Create Your First Project
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="bg-white rounded-xl p-6 border border-border hover:shadow-md hover:border-accent/30 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-primary">{project.title}</h3>
                  {project.description && (
                    <p className="mt-1 text-sm text-text-muted line-clamp-1">{project.description}</p>
                  )}
                  <p className="mt-2 text-xs text-text-muted">{formatDate(project.created_at)}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[project.status] ?? ""}`}>
                  {statusLabels[project.status] ?? project.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
