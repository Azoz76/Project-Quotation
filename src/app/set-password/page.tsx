"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Check } from "lucide-react";
import { ConstructionBg } from "@/components/construction-bg";

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordForm />
    </Suspense>
  );
}

function SetPasswordForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const isValid = hasMinLength && hasUppercase && hasNumber && passwordsMatch;

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
      setTimeout(() => {
        window.location.href = next;
      }, 1500);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary">
      <ConstructionBg />

      <div className="relative w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl">
        <div className="text-center mb-8">
          <img src="/logo.jpg" alt="Towers Purebred Co." className="mx-auto h-20 w-auto mb-2" />
          <h1 className="text-2xl font-bold text-primary">Set Your Password</h1>
          <p className="mt-2 text-text-muted">
            Create a password so you can log in next time
          </p>
        </div>

        {status === "success" ? (
          <div className="text-center p-6 bg-green-50 rounded-xl">
            <Check className="mx-auto h-12 w-12 text-green-500" />
            <h2 className="mt-4 text-lg font-semibold text-green-800">Password set!</h2>
            <p className="mt-2 text-green-700">Redirecting to your dashboard...</p>
          </div>
        ) : (
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
                  placeholder="Create a strong password"
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
                placeholder="Confirm your password"
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

            {status === "error" && (
              <p className="text-sm text-red-600">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={!isValid || status === "loading"}
              className="w-full py-3 px-4 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === "loading" ? "Setting password..." : "Set Password & Continue"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
