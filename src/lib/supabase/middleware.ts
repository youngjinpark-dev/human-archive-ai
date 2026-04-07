import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
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

  // 인증 안 된 사용자 → 로그인 페이지로 리다이렉트
  const isAuthPage =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup");
  const isApiExternal = request.nextUrl.pathname.startsWith("/api/external");
  const isApiStore = request.nextUrl.pathname.startsWith("/api/store");
  const isWellKnown = request.nextUrl.pathname.startsWith("/.well-known");
  const isRootPage = request.nextUrl.pathname === "/";
  const isStoreBrowsing = request.nextUrl.pathname.startsWith("/store");

  if (!user && !isAuthPage && !isApiExternal && !isApiStore && !isWellKnown && !isRootPage && !isStoreBrowsing) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 이미 로그인한 사용자가 auth 페이지 접근 시 대시보드로
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/personas";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
