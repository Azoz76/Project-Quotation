"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

type Notification = {
  id: string;
  message: string;
  read: boolean;
  link: string | null;
  created_at: string;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      setNotifications(data ?? []);
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel("notif-page")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function markAsRead(id: string) {
    const supabase = createClient();
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Notifications</h1>

      {notifications.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Wrapper = n.link ? Link : "div";
            return (
              <Wrapper
                key={n.id}
                href={n.link ?? "#"}
                onClick={() => !n.read && markAsRead(n.id)}
                className={`block px-5 py-4 rounded-xl border transition-colors cursor-pointer ${
                  n.read
                    ? "bg-white border-gray-200"
                    : "bg-blue-50 border-blue-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className={`text-sm ${n.read ? "text-gray-600" : "text-gray-900 font-medium"}`}>
                    {n.message}
                  </p>
                  {!n.read && (
                    <span className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0 ml-3" />
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">{formatDate(n.created_at)}</p>
              </Wrapper>
            );
          })}
        </div>
      )}
    </div>
  );
}
