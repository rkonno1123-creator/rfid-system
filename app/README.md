🔧 RFID入退場システム 引き継ぎメモ
■ 全体概要

目的：
M5Stack Core2（RFIDユニット）でUIDを読み取り、Firebase Realtime Database に記録。
Next.js (React) + Tailwind で UI 表示。

構成：

M5Stack Core2 ─→ Firebase RTDB ─→ Next.js（表示）


主要DBノード：

/logs     ← 全履歴（append-only）
/members  ← UID → { name, company }
/latest   ← 現在の状態（自動更新）※UI側で計算してPATCH保存

■ 各レイヤーの役割
M5Stack

UID, ts（time.time()）を JSON で /logs に POST。

700ms クールダウンで誤二重送信防止。

WiFi接続は手動実装済。

Firebase

RTDB URL
https://rfid-cd77f-default-rtdb.asia-southeast1.firebasedatabase.app

セキュリティルール（検証済み）

{
  "rules": {
    ".read": true,
    "logs": { ".write": true, ".indexOn": ["ts", "uid"] },
    "latest": { ".write": true },
    ".write": false
  }
}


/members は手動登録。UIDがキー。

■ フロントエンド (Next.js)
技術構成

Framework：Next.js 13+ (App Router)

Style：Tailwind CSS

Hosting：Vercel（予定）

データフロー

/members と /logs をフェッチ

全履歴（allLogs）から偶奇で入退場を判定

/latest にPATCHでキャッシュ保存

表示：

左：IN/OUTカード（最新状態）

右：ログテーブル（直近10〜50件）

■ 色分けロジック
function companyAccent(company?: string) {
  const c = (company || "").toLowerCase();
  if (c.includes("会社い")) return "border-l-violet-300";
  if (c.includes("会社う")) return "border-l-rose-300";
  if (c.includes("riverlands") || c.includes("リバーランズ")) return "border-l-blue-300";
  if (c.includes("協力") || c.includes("partner")) return "border-l-emerald-300";
  if (c.includes("竹内塗装")) return "border-l-amber-300";
  return "border-l-gray-300";
}

■ 公開手順（Vercel）

git init && git add . && git commit -m "init"

vercel.com
 → New Project

Next.js 自動検出 → Deploy

公開URLで /members / /logs の通信確認（ステータス200）

■ 注意点

UIDのIN/OUT判定は全履歴（allLogs）から算出。

/latest が壊れても復元可能（logs再読込で再生成）。

RTDBは無料枠で十分（1〜2現場なら問題なし）。

将来、現場別切替を行う場合は /logs/{site_id}/... へ分離する。

■ ToDo（次フェーズ）

 会社別のカラー設定（定義テーブル化）

 現場単位でのフィルタ切替

 レスポンシブ最適化（スマホ用カード2列）

 表示更新の最適化（useSWRで差分取得）