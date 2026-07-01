"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { HardHat, Shield, Eye, EyeOff, Check } from "lucide-react";
import { ConstructionBg } from "@/components/construction-bg";

type UserType = "client" | "admin";
type AuthMode = "signup" | "login" | "forgot";

export default function LoginPage() {
  const [userType, setUserType] = useState<UserType>("client");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [resetVerified, setResetVerified] = useState(false);

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const signupValid = hasMinLength && hasUppercase && hasNumber && passwordsMatch && agreedToTerms && fullName.trim().length > 0;

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!signupValid) return;
    setStatus("loading");
    setErrorMsg("");

    // Use admin signup route — creates user with email auto-confirmed,
    // so no confirmation email is sent (avoids Supabase email rate limit).
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        full_name: fullName.trim(),
        contact_number: contactNumber.trim(),
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      setStatus("error");
      setErrorMsg(json.error ?? "Sign up failed. Please try again.");
      return;
    }

    // User is already confirmed — sign them in immediately
    const supabase = createClient();
    const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error("Sign in timed out. Please try logging in.") }), 15000)
    );
    const { error: signInError } = await Promise.race([
      supabase.auth.signInWithPassword({ email, password }),
      timeoutPromise,
    ]);

    if (signInError) {
      setStatus("error");
      setErrorMsg(signInError.message);
    } else {
      window.location.href = "/dashboard";
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    const supabase = createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    const supabase = createClient();

    const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(() => resolve({
        data: null,
        error: new Error("Connection timed out. Please check your internet and try again."),
      }), 15000)
    );

    const { error } = await Promise.race([
      supabase.auth.signInWithPassword({ email, password }),
      timeoutPromise,
    ]);

    if (error) {
      setStatus("error");
      setErrorMsg(error.message || "Invalid email or password. Please try again.");
    } else {
      const redirectPath = userType === "admin" ? "/admin" : "/dashboard";
      window.location.href = redirectPath;
    }
  }

  // Detect when the user returns from clicking the recovery email link
  // (/auth/callback redirects to /login?reset=1 after verifying the session)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset") === "1") {
      setResetVerified(true);
      setAuthMode("forgot");
      setStatus("sent");
      // Clean the URL so a refresh doesn't re-trigger
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  function resetForm() {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setFullName("");
    setContactNumber("");
    setShowPassword(false);
    setAgreedToTerms(false);
    setStatus("idle");
    setErrorMsg("");
  }

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
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl">
        <div className="text-center mb-6">
          <div className="px-4">
            <img src="/logo.jpg" alt="Towers Purebred Co." className="w-full h-auto object-contain" />
          </div>
          <p className="mt-2 text-text-muted">
            AI-powered construction quotations
          </p>
        </div>

        {/* Client/Admin tabs — login and forgot only (not signup) */}
        {authMode !== "signup" && (
          <div className="flex rounded-xl bg-surface p-1 mb-6">
            <button
              type="button"
              onClick={() => { setUserType("client"); resetForm(); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                userType === "client"
                  ? "bg-white text-primary shadow-sm"
                  : "text-text-muted hover:text-primary"
              )}
            >
              <HardHat className="h-4 w-4" />
              Client
            </button>
            <button
              type="button"
              onClick={() => { setUserType("admin"); resetForm(); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                userType === "admin"
                  ? "bg-white text-primary shadow-sm"
                  : "text-text-muted hover:text-primary"
              )}
            >
              <Shield className="h-4 w-4" />
              Admin
            </button>
          </div>
        )}

        {authMode !== "signup" && (
          <div className="mb-6 p-3 rounded-lg text-sm bg-surface-alt text-primary-light">
            {userType === "client"
              ? "Upload drawings and receive instant quotations for your construction project."
              : "Sign in to manage users, content, and view analytics."
            }
          </div>
        )}

        {status === "sent" ? (
          <div className="text-center p-6 bg-green-50 rounded-xl">
            {resetVerified ? (
              /* State 2: user clicked email link → session established → redirected back */
              <>
                <div className="mx-auto h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="mt-4 text-lg font-semibold text-green-800">Email Verified!</h2>
                <p className="mt-2 text-sm text-green-700">
                  Your identity has been confirmed. You can now set your new password.
                </p>
                <button
                  onClick={() => { window.location.href = "/reset-password"; }}
                  className="mt-5 w-full py-3 px-4 bg-accent text-white font-semibold rounded-lg hover:bg-accent-hover transition-colors"
                >
                  Enter New Password
                </button>
              </>
            ) : authMode === "forgot" ? (
              /* State 1: reset email sent, waiting for user to click link */
              <>
                <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <h2 className="mt-4 text-lg font-semibold text-green-800">Check your email</h2>
                <p className="mt-2 text-green-700 text-sm">
                  We sent a password reset link to <strong>{email}</strong>
                </p>
                <p className="mt-1 text-sm text-green-600">
                  Click the link in your email — then the button below will activate.
                </p>
                <button
                  disabled
                  className="mt-5 w-full py-3 px-4 bg-gray-200 text-gray-400 font-semibold rounded-lg cursor-not-allowed select-none"
                >
                  Enter New Password
                </button>
                <p className="mt-2 text-xs text-green-600 italic">Waiting for you to click the email link…</p>
              </>
            ) : (
              /* Signup confirmation email */
              <>
                <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <h2 className="mt-4 text-lg font-semibold text-green-800">Check your email</h2>
                <p className="mt-2 text-sm text-green-700">
                  We sent a confirmation link to <strong>{email}</strong>
                </p>
                <p className="mt-1 text-sm text-green-600">
                  Click the link to verify your account and start using the app.
                </p>
                <button
                  onClick={() => { resetForm(); setAuthMode("login"); }}
                  className="mt-4 text-sm text-accent hover:text-accent-hover underline"
                >
                  Back to Log In
                </button>
              </>
            )}
            {/* Always show a back link for forgot/reset states */}
            {authMode === "forgot" && (
              <button
                onClick={() => { setResetVerified(false); resetForm(); setAuthMode("login"); }}
                className="mt-3 block w-full text-sm text-text-muted hover:text-foreground underline"
              >
                Back to Log In
              </button>
            )}
          </div>

        ) : authMode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={userType === "client" ? "you@example.com" : "admin@company.com"}
                className="mt-1 block w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => { setAuthMode("forgot"); resetForm(); }}
                  className="text-xs text-accent hover:text-accent-hover hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
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

            {status === "error" && (
              <p className="text-sm text-red-600">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full py-3 px-4 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === "loading" ? "Signing in..." : "Log In"}
            </button>

            {userType === "client" && (
              <p className="text-center text-sm text-text-muted">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => { setAuthMode("signup"); resetForm(); }}
                  className="font-medium text-accent hover:text-accent-hover hover:underline"
                >
                  Sign Up
                </button>
              </p>
            )}
          </form>

        ) : authMode === "forgot" ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label htmlFor="forgot-email" className="block text-sm font-medium text-foreground">
                Email address
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your registered email"
                className="mt-1 block w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
              />
            </div>

            {status === "error" && (
              <p className="text-sm text-red-600">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full py-3 px-4 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === "loading" ? "Sending..." : "Send Reset Link"}
            </button>

            <p className="text-center text-sm text-text-muted">
              Remember your password?{" "}
              <button
                type="button"
                onClick={() => { setAuthMode("login"); resetForm(); }}
                className="font-medium text-accent hover:text-accent-hover hover:underline"
              >
                Log In
              </button>
            </p>
          </form>

        ) : (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="mb-2 p-3 rounded-lg text-sm bg-surface-alt text-primary-light">
              Create your client account to get construction quotations.
            </div>

            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-foreground">
                Full Name *
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className="mt-1 block w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-foreground">
                Email address *
              </label>
              <input
                id="signup-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 block w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label htmlFor="contactNumber" className="block text-sm font-medium text-foreground">
                Contact Number
              </label>
              <input
                id="contactNumber"
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="+966 5XX XXX XXXX"
                className="mt-1 block w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label htmlFor="signup-password" className="block text-sm font-medium text-foreground">
                Password *
              </label>
              <div className="relative mt-1">
                <input
                  id="signup-password"
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
              <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground">
                Confirm Password *
              </label>
              <input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="mt-1 block w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
              />
            </div>

            {password.length > 0 && (
              <div className="space-y-1 text-xs">
                <div className={`flex items-center gap-1.5 ${hasMinLength ? "text-green-600" : "text-text-muted"}`}>
                  <Check className="h-3.5 w-3.5" /> At least 8 characters
                </div>
                <div className={`flex items-center gap-1.5 ${hasUppercase ? "text-green-600" : "text-text-muted"}`}>
                  <Check className="h-3.5 w-3.5" /> One uppercase letter
                </div>
                <div className={`flex items-center gap-1.5 ${hasNumber ? "text-green-600" : "text-text-muted"}`}>
                  <Check className="h-3.5 w-3.5" /> One number
                </div>
                {confirmPassword.length > 0 && (
                  <div className={`flex items-center gap-1.5 ${passwordsMatch ? "text-green-600" : "text-red-500"}`}>
                    <Check className="h-3.5 w-3.5" /> Passwords match
                  </div>
                )}
              </div>
            )}

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border text-accent focus:ring-accent"
              />
              <span className="text-xs text-text-muted leading-relaxed">
                I agree to the{" "}
                <a href="/terms" target="_blank" className="text-accent hover:text-accent-hover underline">
                  Terms &amp; Conditions
                </a>{" "}
                and{" "}
                <a href="/privacy" target="_blank" className="text-accent hover:text-accent-hover underline">
                  Privacy Policy
                </a>
              </span>
            </label>

            {status === "error" && (
              <p className="text-sm text-red-600">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={!signupValid || status === "loading"}
              className="w-full py-3 px-4 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === "loading" ? "Creating account..." : "Sign Up"}
            </button>

            <p className="text-center text-sm text-text-muted">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => { setAuthMode("login"); resetForm(); }}
                className="font-medium text-accent hover:text-accent-hover hover:underline"
              >
                Log In
              </button>
            </p>
          </form>
        )}
      </div>
      </div>
    </div>
  );
}
