# 호두인베스트 랜딩페이지 — Netlify 배포 안내

## 0. 먼저 알아야 할 점

기존 청담투자 랜딩은 **Python(`server.py`) + Railway** 구조입니다.
**Netlify는 파이썬 서버를 실행할 수 없기 때문에**, 이 폴더에서는 같은 기능을
**Netlify Functions(Node) + Netlify Blobs(데이터 저장소)** 로 새로 구현했습니다.
청담투자 사이트(Railway)는 그대로 두고, 이 폴더만 Netlify에 올리면 됩니다.

## 1. 폴더 구성

```
hodu-netlify/
├─ netlify.toml                  Netlify 설정 (배포 폴더·함수 폴더·헤더)
├─ package.json                  함수용 패키지 (@netlify/blobs)
├─ public/
│   ├─ index.html                랜딩페이지 (방문자 화면)
│   └─ admin.html                관리자 페이지  → 주소: /admin
└─ netlify/
    ├─ functions/
    │   ├─ leads.mjs             POST /api/leads          상담신청 접수
    │   ├─ admin.mjs             /api/admin/*             로그인·명단·삭제·CSV
    │   └─ content.mjs           /api/content             랜딩 문구 저장/불러오기
    └─ lib/shared.mjs            공통 유틸(토큰·검증) — 외부에 노출되지 않음
```

## 2. 배포 순서 (GitHub 연동 · 권장)

1. **GitHub에 저장소 만들기** (예: `hodu-invest-landing`, Private 권장)
2. 이 폴더에서 아래 명령 실행 (이미 `git init` + 첫 커밋까지 되어 있습니다)
   ```
   git remote add origin https://github.com/<내계정>/hodu-invest-landing.git
   git branch -M main
   git push -u origin main
   ```
3. **https://app.netlify.com/start** → **GitHub** 선택 → 방금 만든 저장소 선택
4. 빌드 설정은 `netlify.toml`을 자동으로 읽습니다. 화면에 아래처럼 나오면 그대로 두세요.
   - Build command : `npm install --omit=dev`
   - Publish directory : `public`
   - Functions directory : `netlify/functions`
5. **Deploy** 클릭 → 1~2분 후 `https://<임의이름>.netlify.app` 발급

> 참고 · 드래그&드롭 배포(app.netlify.com/drop)는 **쓰지 마세요.**
> 패키지 설치 단계가 없어서 상담신청 API가 동작하지 않습니다.

## 3. ⚠ 배포 직후 반드시 할 일 — 환경변수 등록

Netlify 대시보드 → **Site configuration → Environment variables → Add a variable**

| 변수명 | 값 | 설명 |
|---|---|---|
| `ADMIN_PASSWORD` | (직접 정한 강한 비밀번호) | 관리자 로그인 · **필수** |
| `ADMIN_SECRET` | 아무 긴 랜덤 문자열 32자 이상 | 로그인 토큰 서명용 · 권장 |

등록 후 **Deploys → Trigger deploy → Deploy site** 로 한 번 재배포해야 적용됩니다.
`ADMIN_PASSWORD`가 없으면 관리자 로그인이 막히고, 상담신청 접수만 동작합니다.

## 4. 사용 방법

| 기능 | 주소 |
|---|---|
| 랜딩페이지 | `https://<사이트>.netlify.app/` |
| 관리자(명단 관리) | `https://<사이트>.netlify.app/admin` |
| 랜딩 문구 편집 | `https://<사이트>.netlify.app/?edit=1` |

- **명단 관리**: 총/오늘/최근7일/최다 관심분야 집계, 이름·연락처 검색, 선택 삭제,
  전체 삭제, **CSV 내보내기**(엑셀에서 한글 안 깨짐)
- **문구 편집**: `?edit=1` → 관리자 비밀번호 입력 → 화면의 글자를 직접 수정 →
  **[사이트에 반영]** 을 눌러야 방문자에게 적용됩니다.
  (버튼 링크 주소도 편집 패널에서 수정 가능)

## 5. 데이터

- 저장 위치: **Netlify Blobs** (`hodu-leads` / `hodu-site` 저장소)
- 재배포·재시작해도 유지됩니다. 별도 DB 서비스 가입 불필요.
- 저장 항목: 성함, 연락처, 투자경험, 관심분야, 신청일시(KST), IP, 접속지역

## 6. 스팸 방어 (이미 적용됨)

- 숨은 입력칸(허니팟) — 봇이 채우면 조용히 버림
- 같은 IP: 20초 내 재신청 차단 / 1시간 6건 초과 차단
- 같은 휴대폰번호 중복 신청 차단
- 이름·번호·관심분야·투자경험 형식 검증 (허용값 외 거부)
- 관리자 로그인 10분 내 5회 실패 시 차단

## 7. 로컬에서 미리 보기

```
cd hodu-netlify
npm install
npx netlify dev --offline
```
→ http://localhost:8888 (관리자: http://localhost:8888/admin)
로컬 테스트용 비밀번호는 실행 전 환경변수로 지정하세요.
PowerShell: `$env:ADMIN_PASSWORD='test1234'`

## 8. 운영 전 남은 일

- [ ] `public/index.html` 상단 `CONFIG`의 회사 정보 교체
      (대표전화, 이메일, 주소, 사업자등록번호, 투자자문업 등록번호, 등록일)
- [ ] `trust.buttons[0].url` — 자문사 실제 홈페이지 주소
- [ ] 파인·금융위원회·금융감독원 **공식 로고 이미지 파일**로 교체
      (`public/assets/`에 넣고 `CONFIG.topLinks[].img`에 경로 입력.
       현재는 임시 도형이며, 기관 로고 사용 전 각 기관의 사용 규정을 확인하세요.)
- [ ] 개인정보 수집·이용 동의 "자세히 보기"(`form.consentMoreUrl`) 문서 연결
- [ ] 투자자문업 표시·광고 규정 검토 (문구·면책 표시)
