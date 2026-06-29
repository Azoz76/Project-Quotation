"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bell } from "lucide-react";
import Link from "next/link";

export function NotificationBell({ userId }: { userId: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    async function fetchCount() {
      const { count: c } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("read", false);
      setCount(c ?? 0);
    }

    fetchCount();

    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => fetchCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <Link
      href="/dashboard/notifications"
      className="relative p-2 text-text-muted hover:text-primary transition-colors"
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-5 w-5 bg-accent text-white text-xs rounded-full flex items-center justify-center">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
