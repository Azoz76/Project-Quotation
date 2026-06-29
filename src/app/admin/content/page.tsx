"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";

type ContentItem = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  deleted_at: string | null;
  users: { email: string; full_name: string | null } | null;
};

export default function AdminContentPage() {
  const [projects, setProjects] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("projects")
      .select("id, title, status, created_at, users(email, full_name)")
      .order("created_at", { ascending: false });
    setProjects((data as unknown as ContentItem[]) ?? []);
    setLoading(false);
  }

  async function deleteProject(id: string) {
    if (!confirm("Soft-delete this project?")) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("projects").update({ status: "deleted" as never }).eq("id", id);
    await supabase.from("audit_log").insert({
      admin_id: user.id,
      action: "delete_project",
      target_id: id,
    });
    load();
  }

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Content Management</h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Project</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Author</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Created</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="px-5 py-3 font-medium text-gray-900">{p.title}</td>
                <td className="px-5 py-3 text-gray-600">{p.users?.full_name ?? p.users?.email ?? "—"}</td>
                <td className="px-5 py-3">
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{p.status}</span>
                </td>
                <td className="px-5 py-3 text-gray-400">{formatDate(p.created_at)}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => deleteProject(p.id)}
                    className="text-xs font-medium text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
