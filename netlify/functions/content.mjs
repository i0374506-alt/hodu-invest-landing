/* /api/content — 랜딩페이지 문구(CONFIG) 저장소
   GET : 공개. 저장된 문구가 없으면 {} → 페이지 기본값 사용
   PUT : 관리자만. 편집 모드의 "사이트에 반영" 버튼이 호출 */
import { getStore } from "@netlify/blobs";
import { json, authed, kst } from "../lib/shared.mjs";

export const config = { path: "/api/content" };

const KEY = "content.json";
const site = () => getStore({ name: "hodu-site", consistency: "strong" });

export default async (req) => {
  if (req.method === "GET") {
    const data = await site().get(KEY, { type: "json" }).catch(() => null);
    return json(data || {}, 200, { "cache-control": "public, max-age=30" });
  }

  if (req.method === "PUT" || req.method === "POST") {
    if (!authed(req)) return json({ error: "unauthorized" }, 401);
    let body;
    try { body = await req.json(); } catch { return json({ error: "잘못된 형식입니다." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return json({ error: "잘못된 형식입니다." }, 400);
    const raw = JSON.stringify(body);
    if (raw.length > 200_000) return json({ error: "내용이 너무 큽니다." }, 413);

    /* 직전 버전 1개 백업 (실수 복구용) */
    const prev = await site().get(KEY).catch(() => null);
    if (prev) await site().set(KEY + ".bak", prev).catch(() => {});

    await site().setJSON(KEY, body);
    return json({ ok: true, savedAt: kst() });
  }

  return json({ error: "method not allowed" }, 405);
};
