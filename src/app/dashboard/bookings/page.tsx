"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { format } from "date-fns";

type TimeSlot = {
  id: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  description: string | null;
};

type Booking = {
  id: string;
  status: string;
  created_at: string;
  time_slots: { start_time: string; end_time: string; description: string | null };
};

export default function BookingsPage() {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [slotsRes, bookingsRes] = await Promise.all([
      supabase
        .from("time_slots")
        .select("*")
        .gte("start_time", new Date().toISOString())
        .order("start_time"),
      supabase
        .from("bookings")
        .select("id, status, created_at, time_slots(start_time, end_time, description)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    setSlots(slotsRes.data ?? []);
    setBookings((bookingsRes.data as unknown as Booking[]) ?? []);
    setLoading(false);
  }

  async function bookSlot(slotId: string) {
    setBooking(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.rpc("book_time_slot" as never, {
      p_user_id: user.id,
      p_slot_id: slotId,
    } as never);

    if (!error) {
      await load();
    }
    setBooking(false);
  }

  async function cancelBooking(bookingId: string) {
    const supabase = createClient();
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", bookingId);
    await load();
  }

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Bookings</h1>

      {bookings.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Your Bookings</h2>
          <div className="space-y-2">
            {bookings.map((b) => (
              <div key={b.id} className="bg-white rounded-xl p-4 border border-gray-200 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {format(new Date(b.time_slots.start_time), "MMM d, yyyy h:mm a")} -{" "}
                    {format(new Date(b.time_slots.end_time), "h:mm a")}
                  </p>
                  {b.time_slots.description && (
                    <p className="text-sm text-gray-500">{b.time_slots.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Booked {formatDate(b.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    b.status === "confirmed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {b.status}
                  </span>
                  {b.status === "confirmed" && (
                    <button
                      onClick={() => cancelBooking(b.id)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold text-gray-900 mb-3">Available Slots</h2>
      {slots.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">No available time slots</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {slots
            .filter((s) => s.booked_count < s.capacity)
            .map((slot) => (
              <div key={slot.id} className="bg-white rounded-xl p-4 border border-gray-200 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {format(new Date(slot.start_time), "MMM d, yyyy h:mm a")} -{" "}
                    {format(new Date(slot.end_time), "h:mm a")}
                  </p>
                  {slot.description && <p className="text-sm text-gray-500">{slot.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {slot.capacity - slot.booked_count} of {slot.capacity} spots left
                  </p>
                </div>
                <button
                  onClick={() => bookSlot(slot.id)}
                  disabled={booking}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
                >
                  Book
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
