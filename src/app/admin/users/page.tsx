"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";

type User = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  disabled: boolean;
  created_at: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });
    setUsers(data ?? []);
    setLoading(false);
  }

  async function toggleDisabled(userId: string, disabled: boolean) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("users").update({ disabled: !disabled }).eq("id", userId);
    await supabase.from("audit_log").insert({
      admin_id: user.id,
      action: disabled ? "reactivate_user" : "deactivate_user",
      target_id: userId,
    });
    load();
  }

  async function changeRole(userId: string, newRole: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("users").update({ role: newRole as "client" | "admin" }).eq("id", userId);
    await supabase.from("audit_log").insert({
      admin_id: user.id,
      action: "change_role",
      target_id: userId,
      details: { new_role: newRole },
    });
    load();
  }

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">User Management</h1>

      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">All Roles</option>
          <option value="client">Client</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Email</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Role</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Joined</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-gray-100">
                <td className="px-5 py-3 font-medium text-gray-900">{u.full_name ?? "—"}</td>
                <td className="px-5 py-3 text-gray-600">{u.email}</td>
                <td className="px-5 py-3">
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    className="text-xs border border-gray-200 rounded px-2 py-1"
                  >
                    <option value="client">Client</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-5 py-3 text-gray-400">{formatDate(u.created_at)}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.disabled ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                  }`}>
                    {u.disabled ? "Disabled" : "Active"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => toggleDisabled(u.id, u.disabled)}
                    className={`text-xs font-medium ${
                      u.disabled ? "text-green-600 hover:text-green-800" : "text-red-600 hover:text-red-800"
                    }`}
                  >
                    {u.disabled ? "Reactivate" : "Deactivate"}
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
