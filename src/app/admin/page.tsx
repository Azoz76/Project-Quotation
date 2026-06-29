import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Users, FileText, BarChart3 } from "lucide-react";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [
    { count: totalUsers },
    { count: newSignups },
    { count: totalProjects },
    { count: totalQuotations },
  ] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase.from("quotations").select("*", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "Total Users", value: totalUsers ?? 0 },
    { label: "New Signups (7d)", value: newSignups ?? 0 },
    { label: "Total Projects", value: totalProjects ?? 0 },
    { label: "Total Quotations", value: totalQuotations ?? 0 },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-6">Admin Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-6 border border-border">
            <p className="text-sm text-text-muted">{s.label}</p>
            <p className="text-3xl font-bold text-primary mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/admin/users" className="bg-white rounded-xl p-6 border border-border hover:shadow-md hover:border-accent/30 transition-all">
          <Users className="h-8 w-8 text-accent mb-3" />
          <h3 className="font-semibold text-primary">User Management</h3>
          <p className="text-sm text-text-muted mt-1">View, search, and manage user accounts</p>
        </Link>
        <Link href="/admin/content" className="bg-white rounded-xl p-6 border border-border hover:shadow-md hover:border-accent/30 transition-all">
          <FileText className="h-8 w-8 text-accent mb-3" />
          <h3 className="font-semibold text-primary">Content Management</h3>
          <p className="text-sm text-text-muted mt-1">Moderate projects and uploads</p>
        </Link>
        <Link href="/admin/analytics" className="bg-white rounded-xl p-6 border border-border hover:shadow-md hover:border-accent/30 transition-all">
          <BarChart3 className="h-8 w-8 text-accent mb-3" />
          <h3 className="font-semibold text-primary">Analytics</h3>
          <p className="text-sm text-text-muted mt-1">Usage statistics and charts</p>
        </Link>
      </div>
    </div>
  );
}
