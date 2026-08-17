/* POST /api/leads — 상담신청 접수 (공개)
   저장소: Netlify Blobs "hodu-leads" (배포·재시작해도 유지됨) */
import { getStore } from "@netlify/blobs";
import { json, kst, clientIp, ALLOWED_INTERESTS, ALLOWED_EXPERIENCE } from "../lib/shared.mjs";

export const config = { path: "/api/leads" };

const PHONE = /^01[0-9]\d{7,8}$/;
const RATE_WINDOW = 3600e3;   // 1시간
const RATE_MAX = 6;           // IP당 시간당 최대 신청 수
const MIN_INTERVAL = 20e3;    // IP당 최소 신청 간격

export default async (req, context) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let b = {};
  try { b = await req.json(); } catch { return json({ error: "잘못된 요청입니다." }, 400); }

  /* 허니팟: 숨은 칸이 채워지면 봇 → 성공한 것처럼 응답하고 버림 */
  if (String(b.website || "").trim()) return json({ ok: true });

  const name = String(b.name || "").trim().slice(0, 40);
  const phone = String(b.phone || "").replace(/\D/g, "").slice(0, 11);
  const experience = String(b.experience || "").trim();
  const interests = Array.isArray(b.interests)
    ? [...new Set(b.interests.filter((i) => ALLOWED_INTERESTS.includes(i)))].slice(0, 5)
    : [];

  if (name.length < 2 || /[<>]/.test(name)) return json({ error: "성함을 정확히 입력해 주세요." }, 400);
  if (!PHONE.test(phone)) return json({ error: "연락처를 정확히 입력해 주세요." }, 400);
  if (experience && !ALLOWED_EXPERIENCE.includes(experience))
    return json({ error: "투자경험을 다시 선택해 주세요." }, 400);

  const ip = clientIp(req);

  /* ── 레이트리밋 (IP 기준) ───────────────────────────── */
  try {
    const rl = getStore({ name: "hodu-rate", consistency: "strong" });
    const key = "ip_" + (ip || "unknown").replace(/[^\w.:-]/g, "_");
    const now = Date.now();
    const hits = ((await rl.get(key, { type: "json" })) || []).filter((t) => now - t < RATE_WINDOW);
    if (hits.length && now - hits[hits.length - 1] < MIN_INTERVAL)
      return json({ error: "잠시 후 다시 시도해 주세요." }, 429);
    if (hits.length >= RATE_MAX)
      return json({ error: "요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요." }, 429);
    hits.push(now);
    await rl.setJSON(key, hits);
  } catch (e) { /* 저장소 오류로 접수를 막지는 않음 */ }

  const leads = getStore({ name: "hodu-leads", consistency: "strong" });

  /* ── 같은 번호 중복 신청 차단 ───────────────────────── */
  const dupKey = "dup/" + phone;
  if (await leads.get(dupKey)) return json({ error: "이미 신청하신 정보입니다. 곧 연락드리겠습니다." }, 409);

  const now = new Date();
  const id = now.toISOString().replace(/[-:.TZ]/g, "") + "-" + Math.random().toString(36).slice(2, 8);
  const geo = context?.geo || {};
  const lead = {
    id, name, phone, experience,
    interests,
    interest: interests.join(", "),
    createdAt: kst(now),
    ip,
    country: geo?.country?.name || "",
    countryCode: geo?.country?.code || "",
    region: geo?.subdivision?.name || "",
    city: geo?.city || "",
  };

  await leads.setJSON("lead/" + id, lead);
  await leads.set(dupKey, id);

  return json({ ok: true });
};
