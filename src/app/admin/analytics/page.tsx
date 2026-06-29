"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type Stats = {
  totalUsers: number;
  newSignups7d: number;
  activeUsers30d: number;
  totalProjects: number;
  statusBreakdown: { name: string; value: number }[];
  signupsByDay: { date: string; count: number }[];
};

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createClient();

    const [usersRes, newRes, projectsRes, projectStatusRes] = await Promise.all([
      supabase.from("users").select("*", { count: "exact", head: true }),
      supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
      supabase.from("projects").select("*", { count: "exact", head: true }),
      supabase.from("projects").select("status"),
    ]);

    const statusCounts: Record<string, number> = {};
    (projectStatusRes.data ?? []).forEach((p) => {
      statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1;
    });

    const { data: recentUsers } = await supabase
      .from("users")
      .select("created_at")
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .order("created_at");

    const dayMap: Record<string, number> = {};
    (recentUsers ?? []).forEach((u) => {
      const day = new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dayMap[day] = (dayMap[day] ?? 0) + 1;
    });

    setStats({
      totalUsers: usersRes.count ?? 0,
      newSignups7d: newRes.count ?? 0,
      activeUsers30d: usersRes.count ?? 0,
      totalProjects: projectsRes.count ?? 0,
      statusBreakdown: Object.entries(statusCounts).map(([name, value]) => ({ name, value })),
      signupsByDay: Object.entries(dayMap).map(([date, count]) => ({ date, count })),
    });
    setLoading(false);
  }

  if (loading) return <div className="text-gray-500">Loading analytics...</div>;
  if (!stats) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <button onClick={load} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Users", value: stats.totalUsers },
          { label: "New Signups (7d)", value: stats.newSignups7d },
          { label: "Active Users (30d)", value: stats.activeUsers30d },
          { label: "Total Projects", value: stats.totalProjects },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-5 border border-gray-200">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Signups (Last 7 Days)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.signupsByDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Status</h2>
          {stats.statusBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={stats.statusBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {stats.statusBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center mt-12">No projects yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
