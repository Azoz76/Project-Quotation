import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { to, subject, html } = await request.json();

  try {
    const { data, error } = await resend.emails.send({
      from: "Project Quotation <noreply@yourdomain.com>",
      to,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #2563eb; color: white; padding: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 20px;">Project Quotation</h1>
          </div>
          <div style="padding: 24px; background: #ffffff;">
            ${html}
          </div>
          <div style="padding: 16px 24px; background: #f3f4f6; text-align: center; font-size: 12px; color: #6b7280;">
            <p>You received this because you signed up for Project Quotation.</p>
            <a href="${process.env.NEXT_PUBLIC_SUPABASE_URL}" style="color: #2563eb;">Unsubscribe</a>
          </div>
        </div>
      `,
    });

    if (error) {
      await supabase.from("audit_log").insert({
        admin_id: user.id,
        action: "email_send_failed",
        details: { to, subject, error: error.message },
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err) {
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
