"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // 既に認証されている場合はリダイレクト
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/check");
        if (res.ok) {
          const redirect = searchParams.get("redirect") || "/";
          router.push(redirect);
        }
      } catch (e) {
        // 認証されていない場合はそのまま
      }
    }
    checkAuth();
  }, [router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        const redirect = searchParams.get("redirect") || "/";
        router.push(redirect);
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "パスワードが正しくありません");
      }
    } catch (e) {
      setError("ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Firebase Viewer
        </h1>
        <h2 className="text-lg font-semibold text-gray-700 mb-6 text-center">
          ログイン
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              パスワード
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="パスワードを入力"
              required
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-xl text-white font-bold text-base shadow-lg transition-all ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 active:bg-blue-700 hover:bg-blue-700"
            }`}
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>
      </div>
    </main>
  );
}



