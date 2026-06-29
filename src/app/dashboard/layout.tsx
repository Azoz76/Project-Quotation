import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { NotificationBell } from "@/components/notification-bell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role, full_name, email")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar role={profile?.role ?? "client"} />
      <div className="flex-1 flex flex-col">
        <header className="h-16 bg-white border-b border-border flex items-center justify-between px-6 sticky top-0 z-10">
          <div />
          <div className="flex items-center gap-4">
            <NotificationBell userId={user.id} />
            <div className="text-sm text-text-muted">
              {profile?.full_name ?? profile?.email ?? user.email}
            </div>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
