/* /api/admin/* — 관리자 전용 API
   login / me / leads / delete / clear / export(CSV) */
import { getStore } from "@netlify/blobs";
import { json, authed, issueToken, adminPassword, clientIp } from "../lib/shared.mjs";

export const config = { path: "/api/admin/*" };

const LOGIN_WINDOW = 600e3;   // 10분
const LOGIN_MAX = 5;          // 10분간 로그인 실패 허용 횟수

const store = () => getStore({ name: "hodu-leads", consistency: "strong" });

async function allLeads() {
  const s = store();
  const { blobs } = await s.list({ prefix: "lead/" });
  const rows = await Promise.all(
    blobs.slice(0, 3000).map((b) => s.get(b.key, { type: "json" }).catch(() => null))
  );
  return rows.filter(Boolean).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export default async (req) => {
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  const action = path.split("/api/admin/")[1] || "";

  /* ── 로그인 ─────────────────────────────────────────── */
  if (action === "login") {
    if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
    const pw = adminPassword();
    if (!pw) return json({ error: "서버에 ADMIN_PASSWORD 환경변수가 설정되지 않았습니다." }, 500);

    const ip = clientIp(req) || "unknown";
    const rl = getStore({ name: "hodu-rate", consistency: "strong" });
    const key = "login_" + ip.replace(/[^\w.:-]/g, "_");
    const now = Date.now();
    let fails = ((await rl.get(key, { type: "json" })) || []).filter((t) => now - t < LOGIN_WINDOW);
    if (fails.length >= LOGIN_MAX)
      return json({ error: "로그인 시도가 많습니다. 10분 후 다시 시도해 주세요." }, 429);

    let body = {};
    try { body = await req.json(); } catch {}
    if (String(body.password || "") !== pw) {
      fails.push(now);
      await rl.setJSON(key, fails);
      return json({ error: "비밀번호가 일치하지 않습니다." }, 401);
    }
    await rl.setJSON(key, []);
    return json({ token: issueToken(12) });
  }

  /* ── 아래는 모두 인증 필요 ──────────────────────────── */
  if (!authed(req)) return json({ error: "unauthorized" }, 401);

  if (action === "me") return json({ ok: true });

  if (action === "leads") return json({ leads: await allLeads() });

  if (action === "delete") {
    if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
    let body = {};
    try { body = await req.json(); } catch {}
    const ids = (Array.isArray(body.ids) ? body.ids : [body.id]).filter(Boolean).map(String);
    if (!ids.length) return json({ error: "삭제할 항목이 없습니다." }, 400);
    const s = store();
    let removed = 0;
    for (const id of ids) {
      const row = await s.get("lead/" + id, { type: "json" }).catch(() => null);
      await s.delete("lead/" + id).catch(() => {});
      if (row?.phone) await s.delete("dup/" + row.phone).catch(() => {});
      if (row) removed++;
    }
    return json({ ok: true, removed });
  }

  if (action === "clear") {
    if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
    const s = store();
    const { blobs } = await s.list();
    await Promise.all(blobs.map((b) => s.delete(b.key).catch(() => {})));
    return json({ ok: true, removed: blobs.filter((b) => b.key.startsWith("lead/")).length });
  }

  if (action === "export") {
    const rows = await allLeads();
    const safe = (v) => {
      const s = String(v ?? "");
      const cell = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;      // CSV 수식 인젝션 방어
      return '"' + cell.replace(/"/g, '""') + '"';
    };
    const head = ["등록일시", "이름", "연락처", "투자경험", "관심분야", "IP", "위치"];
    const csv = [head.map(safe).join(",")]
      .concat(rows.map((r) => [
        r.createdAt, r.name, r.phone, r.experience, r.interest, r.ip,
        [r.country, r.region, r.city].filter(Boolean).join(" "),
      ].map(safe).join(",")))
      .join("\r\n");
    return new Response("﻿" + csv, {          // BOM: 엑셀 한글 깨짐 방지
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="hodu-leads.csv"',
        "cache-control": "no-store",
      },
    });
  }

  return json({ error: "not found" }, 404);
};
