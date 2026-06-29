import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FolderOpen, Upload, Calendar, MessageSquare } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { count: projectCount },
    { count: uploadCount },
    { count: bookingCount },
    { count: quotationCount },
  ] = await Promise.all([
    supabase.from("projects").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("uploads").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("bookings").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "confirmed"),
    supabase.from("quotations").select("*", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  const stats = [
    { label: "Projects", value: projectCount ?? 0, icon: FolderOpen, href: "/dashboard/projects" },
    { label: "Uploads", value: uploadCount ?? 0, icon: Upload, href: "/dashboard/uploads" },
    { label: "Bookings", value: bookingCount ?? 0, icon: Calendar, href: "/dashboard/bookings" },
    { label: "Quotations", value: quotationCount ?? 0, icon: MessageSquare, href: "/dashboard/projects" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-primary mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="bg-white rounded-xl p-6 border border-border hover:shadow-md hover:border-accent/30 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-muted">{stat.label}</p>
                  <p className="text-3xl font-bold text-primary mt-1">{stat.value}</p>
                </div>
                <Icon className="h-10 w-10 text-accent opacity-60" />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-border">
          <h2 className="text-lg font-semibold text-primary mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              href="/dashboard/projects/new"
              className="block w-full text-left px-4 py-3 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors font-medium"
            >
              + Create New Project
            </Link>
            <Link
              href="/dashboard/chat"
              className="block w-full text-left px-4 py-3 bg-surface text-primary rounded-lg hover:bg-surface-alt transition-colors font-medium"
            >
              Chat with AI Assistant
            </Link>
            <Link
              href="/dashboard/bookings"
              className="block w-full text-left px-4 py-3 bg-surface text-primary rounded-lg hover:bg-surface-alt transition-colors font-medium"
            >
              Book a Consultation
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-border">
          <h2 className="text-lg font-semibold text-primary mb-4">How It Works</h2>
          <ol className="space-y-3 text-sm text-text-muted">
            <li className="flex gap-3">
              <span className="flex-shrink-0 h-6 w-6 bg-accent/10 text-accent rounded-full flex items-center justify-center text-xs font-bold">1</span>
              Create a project and upload your engineering drawings
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 h-6 w-6 bg-accent/10 text-accent rounded-full flex items-center justify-center text-xs font-bold">2</span>
              Our AI analyzes the drawings and calculates material quantities
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 h-6 w-6 bg-accent/10 text-accent rounded-full flex items-center justify-center text-xs font-bold">3</span>
              Receive an instant quotation with detailed cost breakdown
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 h-6 w-6 bg-accent/10 text-accent rounded-full flex items-center justify-center text-xs font-bold">4</span>
              Book a consultation to discuss your project with our team
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
