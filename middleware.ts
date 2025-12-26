import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /login ページは認証不要
  if (pathname === "/login") {
    return NextResponse.next();
  }

  // 認証Cookieをチェック
  const authCookie = request.cookies.get("auth-token");

  // 認証されていない場合は /login にリダイレクト
  if (!authCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 以下を除くすべてのリクエストパスにマッチ:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - その他の静的ファイル
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|icon-.*\\.png|manifest\\.json).*)",
  ],
};




