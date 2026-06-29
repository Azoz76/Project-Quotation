"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function NewProjectPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        title,
        description: description || null,
        location_address: address || null,
      })
      .select("id")
      .single();

    if (!error && data) {
      router.push(`/dashboard/projects/${data.id}`);
    } else {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-primary mb-6">New Project</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 border border-border space-y-5">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-foreground mb-1">
            Project Title *
          </label>
          <input
            id="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 3-Bedroom House - Phase 1"
            className="w-full px-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-foreground mb-1">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Describe your project..."
            className="w-full px-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none resize-none"
          />
        </div>

        <div>
          <label htmlFor="address" className="block text-sm font-medium text-foreground mb-1">
            Location / Address
          </label>
          <input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 123 Main St, City"
            className="w-full px-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 font-medium transition-colors"
          >
            {saving ? "Creating..." : "Create Project"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 border border-border rounded-lg hover:bg-surface font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
