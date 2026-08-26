/* GET /api/stats — 공개 통계 (신청 건수만 노출, 개인정보 없음)
   실시간 신청 현황 카운터(랜딩페이지)에서 사용 */
import { getStore } from "@netlify/blobs";
import { json } from "../lib/shared.mjs";

export const config = { path: "/api/stats" };

export default async (req) => {
  if (req.method !== "GET") return json({ error: "method not allowed" }, 405);
  try {
    const s = getStore({ name: "hodu-leads", consistency: "eventual" });
    const { blobs } = await s.list({ prefix: "lead/" });
    return json({ count: blobs.length }, 200, { "cache-control": "public, max-age=20" });
  } catch {
    return json({ count: null }, 200, { "cache-control": "public, max-age=20" });
  }
};
