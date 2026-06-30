import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PAGES = ["/login", "/auth/callback", "/terms", "/privacy"];
const PASSWORD_PAGES = ["/set-password", "/reset-password"];
const ALL_AUTH_PAGES = [...PUBLIC_PAGES, ...PASSWORD_PAGES];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseUrl.startsWith("http")) {
    if (!ALL_AUTH_PAGES.includes(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPage = PUBLIC_PAGES.includes(pathname);
  const isPasswordPage = PASSWORD_PAGES.includes(pathname);
  const isAdminPage = pathname.startsWith("/admin");

  // Not logged in — only allow public + password pages
  if (!user && !isPublicPage && !isPasswordPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Logged in on /login — redirect to dashboard (but NOT password pages,
  // and NOT when ?reset=1 which means user just verified their recovery email)
  const isResetReturn = request.nextUrl.searchParams.get("reset") === "1";
  if (user && isPublicPage && pathname === "/login" && !isResetReturn) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Admin check
  if (isAdminPage && user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
