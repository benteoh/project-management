import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { resolveSupabaseEnvConfig } from "./resolve-config";

const PUBLIC_PATH_PREFIXES = ["/_next", "/favicon.ico"];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  if (pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$/)) return true;
  return false;
}

export async function updateSession(request: NextRequest) {
  const { url, anonKey } = resolveSupabaseEnvConfig();

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const openPath = isPublicPath(path);

  if (!user && !openPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    if (path !== "/") {
      loginUrl.searchParams.set("next", path);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (user && path === "/login") {
    const next = request.nextUrl.searchParams.get("next");
    const destination = next && next.startsWith("/") ? next : "/";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return response;
}
