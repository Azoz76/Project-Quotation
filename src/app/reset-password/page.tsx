"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Check, Loader2 } from "lucide-react";
import { ConstructionBg } from "@/components/construction-bg";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"verifying" | "idle" | "loading" | "success" | "error">("verifying");
  const [errorMsg, setErrorMsg] = useState("");

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const isValid = hasMinLength && hasUppercase && hasNumber && passwordsMatch;

  useEffect(() => {
    async function establish() {
      const supabase = createClient();
      const token_hash = searchParams.get("token_hash");
      const type = searchParams.get("type");
      const code = searchParams.get("code");

      if (token_hash && type) {
        // Newer Supabase OTP email flow: token_hash is in the URL directly
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as "recovery" | "signup" | "invite" | "magiclink" | "email_change",
        });
        if (error) {
          setStatus("error");
          setErrorMsg("This reset link has expired or has already been used. Please request a new one.");
          return;
        }
      } else if (code) {
        // PKCE code flow: Supabase verify endpoint redirected here with a code
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setStatus("error");
          setErrorMsg("This reset link has expired or has already been used. Please request a new one.");
          return;
        }
      } else {
        // Session was already established by the /auth/callback route
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setStatus("error");
          setErrorMsg("No valid session found. Please request a new password reset link.");
          return;
        }
      }

      setStatus("idle");
    }

    establish();
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setStatus("loading");
    const supabase = createClient();

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("success");
      // Sign out the recovery session so middleware doesn't bounce /login → /dashboard
      await supabase.auth.signOut();
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    }
  }

  return (
    <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl">
      <div className="text-center mb-8">
        <img src="/logo.jpg" alt="Towers Purebred Co." className="mx-auto h-20 w-auto mb-2" />
        <h1 className="text-2xl font-bold text-primary">Reset Your Password</h1>
        <p className="mt-2 text-text-muted">Enter a new password for your account</p>
      </div>

      {status === "verifying" && (
        <div className="flex flex-col items-center gap-3 py-8 text-text-muted">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-sm">Verifying your reset link…</p>
        </div>
      )}

      {status === "error" && (
        <div className="text-center p-6 bg-red-50 rounded-xl space-y-4">
          <p className="text-red-700 font-medium">{errorMsg}</p>
          <a
            href="/login"
            className="inline-block px-5 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            Back to Login
          </a>
        </div>
      )}

      {status === "success" && (
        <div className="text-center p-6 bg-green-50 rounded-xl">
          <Check className="mx-auto h-12 w-12 text-green-500" />
          <h2 className="mt-4 text-lg font-semibold text-green-800">Password updated!</h2>
          <p className="mt-2 text-green-700">Redirecting to login…</p>
        </div>
      )}

      {(status === "idle" || status === "loading") && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              New Password
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a new password"
                className="block w-full px-4 py-3 pr-12 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-foreground">
              Confirm Password
            </label>
            <input
              id="confirm"
              type={showPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your new password"
              className="mt-1 block w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
            />
          </div>

          <div className="space-y-1.5 text-sm">
            <div className={`flex items-center gap-2 ${hasMinLength ? "text-green-600" : "text-text-muted"}`}>
              <Check className="h-4 w-4" /> At least 8 characters
            </div>
            <div className={`flex items-center gap-2 ${hasUppercase ? "text-green-600" : "text-text-muted"}`}>
              <Check className="h-4 w-4" /> One uppercase letter
            </div>
            <div className={`flex items-center gap-2 ${hasNumber ? "text-green-600" : "text-text-muted"}`}>
              <Check className="h-4 w-4" /> One number
            </div>
            <div className={`flex items-center gap-2 ${passwordsMatch ? "text-green-600" : "text-text-muted"}`}>
              <Check className="h-4 w-4" /> Passwords match
            </div>
          </div>

          <button
            type="submit"
            disabled={!isValid || status === "loading"}
            className="w-full py-3 px-4 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === "loading" ? "Updating…" : "Reset Password"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen relative bg-[#0f2b5b]">
      <style>{`html, body { background: #0f2b5b !important; }`}</style>
      <ConstructionBg />

      <div className="fixed left-0 top-0 bottom-0 w-1/2 pointer-events-none overflow-hidden">
        <img src="/bg-left.png" alt="" className="w-full h-full object-cover object-right opacity-70" />
      </div>
      <div className="fixed right-0 top-0 bottom-0 w-1/2 pointer-events-none overflow-hidden">
        <img src="/bg-right.png" alt="" className="w-full h-full object-cover object-left opacity-70" />
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen py-12 px-4">
        <Suspense
          fallback={
            <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl flex flex-col items-center gap-3 py-16">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
