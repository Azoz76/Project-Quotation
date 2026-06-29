"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { Shield, HardHat, Search } from "lucide-react";

type User = {
  id: string;
  email: string;
  full_name: string | null;
  contact_number: string | null;
  role: string;
  disabled: boolean;
  created_at: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"clients" | "admins">("clients");

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

  const admins = users.filter((u) => u.role === "admin");
  const clients = users.filter((u) => u.role === "client");

  const filtered = (activeTab === "admins" ? admins : clients).filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.full_name ?? "").toLowerCase().includes(q) ||
      (u.contact_number ?? "").includes(q)
    );
  });

  if (loading) return <div className="text-text-muted">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-6">User Management</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <HardHat className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{clients.length}</p>
              <p className="text-sm text-text-muted">Clients</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{admins.length}</p>
              <p className="text-sm text-text-muted">Admins</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-surface p-1 mb-4">
        <button
          onClick={() => setActiveTab("clients")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === "clients"
              ? "bg-white text-primary shadow-sm"
              : "text-text-muted hover:text-primary"
          }`}
        >
          <HardHat className="h-4 w-4" />
          Clients ({clients.length})
        </button>
        <button
          onClick={() => setActiveTab("admins")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === "admins"
              ? "bg-white text-primary shadow-sm"
              : "text-text-muted hover:text-primary"
          }`}
        >
          <Shield className="h-4 w-4" />
          Admins ({admins.length})
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={activeTab === "clients" ? "Search by name, email, or phone..." : "Search by name or email..."}
          className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {activeTab === "clients" ? (
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-text-muted">Name</th>
                <th className="text-left px-5 py-3 font-medium text-text-muted">Email</th>
                <th className="text-left px-5 py-3 font-medium text-text-muted">Phone Number</th>
                <th className="text-left px-5 py-3 font-medium text-text-muted">Joined</th>
                <th className="text-left px-5 py-3 font-medium text-text-muted">Status</th>
                <th className="text-right px-5 py-3 font-medium text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-text-muted">
                    {search ? "No clients match your search" : "No clients registered yet"}
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="border-b border-surface-alt">
                    <td className="px-5 py-3 font-medium text-primary">{u.full_name ?? "—"}</td>
                    <td className="px-5 py-3 text-foreground">{u.email}</td>
                    <td className="px-5 py-3 text-foreground">{u.contact_number ?? "—"}</td>
                    <td className="px-5 py-3 text-text-muted">{formatDate(u.created_at)}</td>
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
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-text-muted">Name</th>
                <th className="text-left px-5 py-3 font-medium text-text-muted">Email</th>
                <th className="text-left px-5 py-3 font-medium text-text-muted">Joined</th>
                <th className="text-left px-5 py-3 font-medium text-text-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-text-muted">
                    {search ? "No admins match your search" : "No admin accounts yet"}
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="border-b border-surface-alt">
                    <td className="px-5 py-3 font-medium text-primary">{u.full_name ?? "—"}</td>
                    <td className="px-5 py-3 text-foreground">{u.email}</td>
                    <td className="px-5 py-3 text-text-muted">{formatDate(u.created_at)}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Active
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {activeTab === "admins" && (
        <p className="mt-4 text-xs text-text-muted">
          Admin accounts can only be created through the Supabase dashboard.
        </p>
      )}
    </div>
  );
}
