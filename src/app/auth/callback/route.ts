import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Parse AMR (Authentication Method Reference) from a Supabase JWT access token. */
function isRecoveryToken(accessToken: string): boolean {
  try {
    const payload = JSON.parse(
      Buffer.from(accessToken.split(".")[1], "base64url").toString()
    );
    // Supabase sets amr = [{method:"otp",...}] for password-recovery sessions
    return (
      Array.isArray(payload.amr) &&
      payload.amr.some(
        (e: { method: string }) => e.method === "otp" || e.method === "recovery"
      )
    );
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";

  const supabase = await createClient();

  // --- token_hash flow (newer Supabase OTP email templates) ---
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "recovery" | "signup" | "invite" | "magiclink" | "email_change",
    });
    if (!error) {
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/login?reset=1`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // --- PKCE code flow ---
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Detect recovery: first check our custom param (if Supabase preserved it),
      // then fall back to inspecting the JWT AMR claim so this works even when
      // Supabase strips query params from the redirectTo URL.
      const isRecovery =
        type === "recovery" ||
        (data.session?.access_token
          ? isRecoveryToken(data.session.access_token)
          : false);

      if (isRecovery) {
        // Redirect back to login page with ?reset=1 so the user sees the
        // "Check your email" view with the "Enter New Password" button enabled.
        return NextResponse.redirect(`${origin}/login?reset=1`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
