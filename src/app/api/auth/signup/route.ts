import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const { email, password, full_name, contact_number } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || serviceRoleKey === "your-service-role-key" || !supabaseUrl) {
    return NextResponse.json(
      { error: "Server configuration missing. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local." },
      { status: 500 }
    );
  }

  // Admin client — bypasses RLS and email sending entirely
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // auto-confirm — no email sent, no rate limit
    user_metadata: {
      full_name: full_name ?? "",
      contact_number: contact_number ?? "",
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ user: { id: data.user.id, email: data.user.email } });
}
