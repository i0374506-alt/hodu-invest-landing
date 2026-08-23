/* 공통 유틸 — 인증 토큰, 응답 헬퍼, 시간/IP 처리 */
import { createHmac, timingSafeEqual } from "node:crypto";

/* 관리자 비밀번호 / 토큰 서명 키 (Netlify 환경변수) */
export const adminPassword = () => (process.env.ADMIN_PASSWORD || "").trim();

/* 토큰 서명 키.
   ⚠ 고정 문자열 기본값을 두지 않는다 — 코드가 유출되면 누구나 관리자 토큰을
     위조할 수 있기 때문. ADMIN_SECRET 이 없으면 비밀번호에서 파생시키고,
     둘 다 없으면 아예 발급/검증하지 않는다. */
const secret = () => {
  const s = (process.env.ADMIN_SECRET || "").trim();
  if (s.length >= 16) return s;
  const pw = adminPassword();
  if (!pw) return "";                                   // 서명 불가
  return createHmac("sha256", "hodu/token-key/v1").update(pw).digest("base64url");
};

/* 문자열 비교 시 길이·내용에 따라 걸리는 시간이 달라지지 않게 (타이밍 공격 방어) */
export function safeEqual(a, b) {
  const ha = createHmac("sha256", "cmp").update(String(a)).digest();
  const hb = createHmac("sha256", "cmp").update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

export const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });

/* ── 토큰: HMAC 서명 + 만료시간 ─────────────────────────── */
export function issueToken(hours = 12) {
  if (!secret()) return "";
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + hours * 3600e3 })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return payload + "." + sig;
}

export function verifyToken(token) {
  if (!secret()) return false;
  if (typeof token !== "string" || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  const expect = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString()).exp > Date.now(); }
  catch { return false; }
}

/* Authorization 헤더 또는 ?token= 쿼리(파일 다운로드용) */
export function authed(req) {
  const h = req.headers.get("authorization") || "";
  const bearer = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  const qs = new URL(req.url).searchParams.get("token") || "";
  return verifyToken(bearer) || verifyToken(qs);
}

/* 한국시간 문자열 "YYYY-MM-DD HH:MM:SS" */
export const kst = (d = new Date()) =>
  new Date(d.getTime() + 9 * 3600e3).toISOString().replace("T", " ").slice(0, 19);

export const clientIp = (req) =>
  (req.headers.get("x-nf-client-connection-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0] || "").trim();

/* 신청 폼 허용값 — 랜딩페이지 CONFIG 와 반드시 동일하게 유지 */
export const ALLOWED_INTERESTS = ["단기", "스윙", "중장기주", "IPO(엔젤투자)", "기타"];
export const ALLOWED_EXPERIENCE = ["1년 미만", "1~3년", "3~5년", "5년 이상"];
