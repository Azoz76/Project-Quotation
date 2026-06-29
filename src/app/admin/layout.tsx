import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar role="admin" />
      <div className="flex-1 flex flex-col">
        <header className="h-16 bg-white border-b border-border flex items-center px-6 sticky top-0 z-10">
          <h1 className="text-lg font-semibold text-primary">Admin Panel</h1>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
