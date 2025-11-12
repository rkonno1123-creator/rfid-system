"use client";

import { useEffect, useMemo, useState } from "react";

const BASE = "https://rfid-cd77f-default-rtdb.asia-southeast1.firebasedatabase.app";
const MEMBERS = `${BASE}/members.json`;
const LOGS = `${BASE}/logs.json`;
const LATEST = `${BASE}/latest.json`;
const DEVICES = `${BASE}/devices.json`;
const REFRESH_MS = 5000;

type LogItem = { id: string; uid?: string; ts?: number; dev?: string };
type MembersMap = Record<string, { name?: string; company?: string }>;
type DevicesMap = Record<string, { site_id?: string; site_name?: string; gate?: string }>;

const fmtTs = (t?: number) => {
  const n = Number(t || 0);
  const ms = n < 10_000_000_000 ? n * 1000 : n;
  return new Date(ms || Date.now()).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
};

function companyAccent(company?: string) {
  const c = (company || "").toLowerCase();
  if (c.includes("riverlands") || c.includes("リバーランズ")) return "border-l-blue-300";
  if (c.includes("協力") || c.includes("partner") || c.includes("協力会社")) return "border-l-emerald-300";
  if (c.includes("竹内塗装")) return "border-l-amber-300";
  return "border-l-gray-300";
}

export default function Page() {
  const [members, setMembers] = useState<MembersMap>({});
  const [devices, setDevices] = useState<DevicesMap>({});
  const [allLogs, setAllLogs] = useState<LogItem[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [logCount, setLogCount] = useState(50);
  const [selectedSite, setSelectedSite] = useState<string>("all");
  const [mounted, setMounted] = useState(false);

  // クライアント側マウント検知
  useEffect(() => {
    setMounted(true);
  }, []);

  // データ取得
  useEffect(() => {
    async function load() {
      try {
        const [mRes, lRes, dRes] = await Promise.all([
          fetch(MEMBERS, { cache: "no-store" }),
          fetch(LOGS, { cache: "no-store" }),
          fetch(DEVICES, { cache: "no-store" })
        ]);

        setMembers((await mRes.json()) || {});
        setDevices((await dRes.json()) || {});

        const raw = (await lRes.json()) || {};
        const items: LogItem[] = Object.entries(raw).map(([id, v]: any) => ({ id, ...(v || {}) }));
        items.sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));

        setAllLogs(items);
      } catch (e) {
        console.error(e);
      }
    }
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, []);

  // 現場リストを生成（site_id でグループ化）
  const siteList = useMemo(() => {
    const sites = new Map<string, { id: string; name: string; devices: string[] }>();
    
    Object.entries(devices).forEach(([devId, info]) => {
      const siteId = info.site_id || "unknown";
      const siteName = info.site_name || siteId;
      
      if (!sites.has(siteId)) {
        sites.set(siteId, { id: siteId, name: siteName, devices: [] });
      }
      sites.get(siteId)!.devices.push(devId);
    });

    return Array.from(sites.values());
  }, [devices]);

  // フィルタされたログ（現場選択に応じて）
  const filteredLogs = useMemo(() => {
    if (selectedSite === "all") return allLogs;
    
    const site = siteList.find(s => s.id === selectedSite);
    if (!site) return allLogs;

    return allLogs.filter(log => site.devices.includes(log.dev || ""));
  }, [allLogs, selectedSite, siteList]);

  // 最新状態（フィルタされたログから算出）
  const latestList = useMemo(() => {
    const map: Record<string, { ts: number; count: number }> = {};
    const asc = [...filteredLogs].sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
    for (const r of asc) {
      const uid = r.uid || ""; if (!uid) continue;
      const prev = map[uid] || { ts: 0, count: 0 };
      map[uid] = { ts: Math.max(prev.ts, Number(r.ts || 0)), count: prev.count + 1 };
    }
    return Object.entries(map)
      .map(([uid, v]) => ({ uid, ts: v.ts, state: v.count % 2 ? 1 : 0 }))
      .sort((a, b) => (b.state - a.state) || (Number(b.ts) - Number(a.ts)));
  }, [filteredLogs]);

  // latest キャッシュ
  useEffect(() => {
    if (latestList.length === 0) return;
    const body = Object.fromEntries(latestList.map(r => [r.uid, { uid: r.uid, ts: r.ts, state: r.state }]));
    fetch(LATEST, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .catch(() => {});
  }, [latestList]);

  // ログに IN/OUT 付与（フィルタされたログで偶奇）
  const logsWithState = useMemo(() => {
    const parity: Record<string, number> = {};
    const asc = [...filteredLogs].sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
    const tagged: (LogItem & { state: 0 | 1 })[] = [];
    for (const r of asc) {
      const u = r.uid || ""; parity[u] = ((parity[u] || 0) + 1) % 2;
      tagged.push({ ...r, state: parity[u] as 0 | 1 });
    }
    return tagged.sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0)).slice(0, logCount);
  }, [filteredLogs, logCount]);

  const latestTs = latestList.length ? latestList[0].ts : 0;

  return (
    <main className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      {/* ヘッダ */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">入退場ビュー</h1>
          
          {/* 現場選択ドロップダウン */}
          <select
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium bg-white shadow-sm"
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
          >
            <option value="all">全現場</option>
            {siteList.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name} ({site.devices.length}台)
              </option>
            ))}
          </select>

          <span className="text-xs text-gray-500">最終更新：{fmtTs(Number(latestTs))}</span>
        </div>
        <button onClick={() => location.reload()} className="px-3 py-1.5 rounded-full bg-gray-900 text-white text-sm shadow">
          再読込
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左：最新状態 */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-700">
              <span className="font-medium">メンバー状態（INが先頭）</span>
              <span className="ml-2 text-gray-500 text-xs">{latestList.length} 名（入場中 {latestList.filter(x=>x.state===1).length}）</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {latestList.map((r) => {
              const m = members[r.uid] || {};
              const inState = r.state === 1;
              return (
                <div
                  key={r.uid}
                  className={`relative bg-white border rounded-2xl shadow-sm p-3 ${companyAccent(m.company)} border-l-4`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="text-[15px] font-semibold">{m.name || r.uid}</div>
                    </div>
                    <span className={`px-3 py-1 text-xs rounded-full ${inState ? "bg-red-600 text-white" : "bg-gray-200 text-gray-700"}`}>
                      {inState ? "IN" : "OUT"}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>最終更新：{r.ts ? fmtTs(Number(r.ts)) : "—"}</div>
                    <div>会社：{m.company || "—"}</div>
                  </div>

                  {!inState && <div className="absolute inset-0 rounded-2xl bg-white/60 pointer-events-none" />}
                </div>
              );
            })}
          </div>
        </section>

        {/* 右：最近ログ */}
        <aside className="lg:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <div className="text-base font-semibold">最近のログ（新着が上）</div>
            <label className="text-xs text-gray-600 flex items-center gap-2">
              件数:
              <select
                className="border rounded-md px-2 py-1 text-xs"
                value={logCount}
                onChange={(e) => setLogCount(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>

          <div className="overflow-auto rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500">
                <tr className="[&>th]:px-3 [&>th]:py-2 border-b">
                  <th className="w-[40%] text-left">時刻</th>
                  <th className="w-[30%] text-left">氏名</th>
                  <th className="w-[15%] text-left">状態</th>
                  <th className="w-[15%] text-left">端末</th>
                </tr>
              </thead>
              <tbody className="text-gray-800">
                {logsWithState.map((r) => {
                  const m = members[r.uid || ""] || {};
                  const inState = (r as any).state === 1;
                  const deviceInfo = devices[r.dev || ""];
                  return (
                    <tr key={r.id} className="[&>td]:px-3 [&>td]:py-2 border-b last:border-b-0">
                      <td className="text-xs text-gray-600">{fmtTs(Number(r.ts))}</td>
                      <td className="font-medium">{m.name || r.uid}</td>
                      <td>
                        <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${inState ? "bg-red-600 text-white" : "bg-gray-200 text-gray-700"}`}>
                          {inState ? "IN" : "OUT"}
                        </span>
                      </td>
                      <td className="text-xs text-gray-500">{r.dev || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </aside>
      </div>
    </main>
  );
}