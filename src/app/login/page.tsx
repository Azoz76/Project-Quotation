"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { HardHat, Shield, Eye, EyeOff } from "lucide-react";
import { ConstructionBg } from "@/components/construction-bg";

type UserType = "client" | "admin";
type AuthMode = "signup" | "login" | "forgot";

export default function LoginPage() {
  const [userType, setUserType] = useState<UserType>("client");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    const supabase = createClient();

    const redirectPath = userType === "admin" ? "/admin" : "/dashboard";

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/set-password?next=" + redirectPath)}`,
        shouldCreateUser: true,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    const supabase = createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
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

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      const redirectPath = userType === "admin" ? "/admin" : "/dashboard";
      window.location.href = redirectPath;
    }
  }

  return (
    <div className="min-h-screen relative bg-[#0f2b5b]">
      <style>{`html, body { background: #0f2b5b !important; }`}</style>
      <ConstructionBg />

      {/* Left construction illustration — covers left half */}
      <div className="fixed left-0 top-0 bottom-0 w-1/2 pointer-events-none overflow-hidden">
        <img
          src="/bg-left.png"
          alt=""
          className="w-full h-full object-cover object-right opacity-70"
        />
      </div>

      {/* Right construction illustration — covers right half */}
      <div className="fixed right-0 top-0 bottom-0 w-1/2 pointer-events-none overflow-hidden">
        <img
          src="/bg-right.png"
          alt=""
          className="w-full h-full object-cover object-left opacity-70"
        />
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

        <div className="flex rounded-xl bg-surface p-1 mb-6">
          <button
            type="button"
            onClick={() => { setUserType("client"); setStatus("idle"); setErrorMsg(""); }}
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
            onClick={() => { setUserType("admin"); setStatus("idle"); setErrorMsg(""); }}
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

        <div className="mb-6 p-3 rounded-lg text-sm bg-surface-alt text-primary-light">
          {userType === "client"
            ? "Upload drawings and receive instant quotations for your construction project."
            : "Manage users, content, and view analytics."
          }
        </div>

        {status === "sent" ? (
          <div className="text-center p-6 bg-green-50 rounded-xl">
            <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h2 className="mt-4 text-lg font-semibold text-green-800">Check your email</h2>
            <p className="mt-2 text-green-700">
              We sent a {authMode === "forgot" ? "password reset" : "verification"} link to <strong>{email}</strong>
            </p>
            <p className="mt-1 text-sm text-green-600">
              {authMode === "forgot"
                ? "Click the link to reset your password."
                : "Click the link to verify your account, then set your password."
              }
            </p>
            <button
              onClick={() => { setStatus("idle"); setEmail(""); setAuthMode("login"); }}
              className="mt-4 text-sm text-accent hover:text-accent-hover underline"
            >
              Back to Log In
            </button>
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
                  onClick={() => { setAuthMode("forgot"); setStatus("idle"); setErrorMsg(""); setPassword(""); }}
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

            <p className="text-center text-sm text-text-muted">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => { setAuthMode("signup"); setStatus("idle"); setErrorMsg(""); setPassword(""); }}
                className="font-medium text-accent hover:text-accent-hover hover:underline"
              >
                Sign Up
              </button>
            </p>
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
                onClick={() => { setAuthMode("login"); setStatus("idle"); setErrorMsg(""); }}
                className="font-medium text-accent hover:text-accent-hover hover:underline"
              >
                Log In
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-foreground">
                Email address
              </label>
              <input
                id="signup-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={userType === "client" ? "you@example.com" : "admin@company.com"}
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
              {status === "loading" ? "Sending..." : "Sign Up"}
            </button>

            <p className="text-center text-sm text-text-muted">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => { setAuthMode("login"); setStatus("idle"); setErrorMsg(""); }}
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
