import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    const sitePassword = process.env.SITE_PASSWORD;

    if (!sitePassword) {
      return NextResponse.json(
        { error: "サーバー設定エラー" },
        { status: 500 }
      );
    }

    if (password !== sitePassword) {
      return NextResponse.json(
        { error: "パスワードが正しくありません" },
        { status: 401 }
      );
    }

    // 認証成功 - Cookieを設定
    const cookieStore = await cookies();
    cookieStore.set("auth-token", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7日間
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "ログインに失敗しました" },
      { status: 500 }
    );
  }
}



