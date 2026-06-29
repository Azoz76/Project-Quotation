"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderOpen,
  Upload,
  MessageSquare,
  Bell,
  Calendar,
  Map,
  LogOut,
  Shield,
} from "lucide-react";
// FolderOpen is used both in navItems and in admin sidebar section

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/projects", label: "Projects", icon: FolderOpen },
  { href: "/dashboard/uploads", label: "Uploads", icon: Upload },
  { href: "/dashboard/map", label: "Map", icon: Map },
  { href: "/dashboard/bookings", label: "Bookings", icon: Calendar },
  { href: "/dashboard/chat", label: "AI Assistant", icon: MessageSquare },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
];

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="w-64 bg-primary text-white flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b border-white/10 flex items-center gap-3">
        <img src="/logo.jpg" alt="Towers Purebred Co." className="h-10 w-auto rounded bg-white p-0.5" />
        <div>
          <h1 className="text-sm font-bold text-white leading-tight">Towers Purebred Co.</h1>
          <p className="text-xs text-white/50">Project Quotation</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}

        {role === "admin" && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-3 text-xs font-semibold text-white/40 uppercase">Admin</p>
            </div>
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                pathname === "/admin"
                  ? "bg-accent text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <Shield className="h-5 w-5" />
              Admin Panel
            </Link>
            <Link
              href="/admin/projects"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                pathname === "/admin/projects"
                  ? "bg-accent text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <FolderOpen className="h-5 w-5" />
              Client Projects
            </Link>
          </>
        )}
      </nav>

      <div className="p-4 border-t border-white/10">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white w-full transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
