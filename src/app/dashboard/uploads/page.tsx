"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";

type UploadRecord = {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  public_url: string;
  category: string;
  created_at: string;
  projects: { title: string } | null;
};

export default function UploadsPage() {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data } = await supabase
        .from("uploads")
        .select("id, file_name, file_type, file_size, public_url, category, created_at, projects(title)")
        .order("created_at", { ascending: false });
      setUploads((data as unknown as UploadRecord[]) ?? []);
      setLoading(false);
    }

    load();
  }, []);

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">All Uploads</h1>

      {uploads.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">No uploads yet. Upload files from a project page.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-500">File</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Project</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Type</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Size</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Date</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((u) => (
                <tr key={u.id} className="border-b border-gray-100">
                  <td className="px-5 py-3 font-medium text-gray-900">{u.file_name}</td>
                  <td className="px-5 py-3 text-gray-600">{u.projects?.title ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                      {u.category}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{(u.file_size / 1024 / 1024).toFixed(2)} MB</td>
                  <td className="px-5 py-3 text-gray-400">{formatDate(u.created_at)}</td>
                  <td className="px-5 py-3 text-right">
                    <a href={u.public_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
