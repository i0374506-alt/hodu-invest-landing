# ── Netlify 드래그(zip) 배포용 파일 만들기 ────────────────────────────
#  사용법:  이 폴더에서  →  powershell -ExecutionPolicy Bypass -File .\zip만들기.ps1
#  결과물:  바탕화면\호두인베스트-netlify-배포.zip
#           → https://app.netlify.com/drop 에 드래그하면 배포됩니다.
#
#  zip 배포는 Netlify가 npm install 을 해주지 않으므로,
#  함수에 필요한 패키지를 esbuild 로 파일 안에 미리 넣어(번들) 둡니다.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$dist = Join-Path $root "dist-drop"
$zip  = Join-Path ([Environment]::GetFolderPath("Desktop")) "호두인베스트-netlify-배포.zip"

if (-not (Test-Path (Join-Path $root "node_modules\@netlify\blobs"))) {
  Write-Host "패키지를 먼저 설치합니다 (npm install)..." -ForegroundColor Yellow
  npm install --no-audit --no-fund | Out-Null
}

# 1) 이전 결과물 정리
if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
New-Item -ItemType Directory -Force -Path "$dist\netlify\functions" | Out-Null

# 2) 정적 파일 복사
Copy-Item "$root\public" "$dist\public" -Recurse -Force

# 3) 함수 번들 (의존 패키지를 파일 안에 포함)
Write-Host "함수를 번들링합니다..." -ForegroundColor Cyan
npx --no-install esbuild `
  "$root\netlify\functions\leads.mjs" `
  "$root\netlify\functions\admin.mjs" `
  "$root\netlify\functions\content.mjs" `
  --bundle --platform=node --target=node20 --format=esm `
  --outdir="$dist\netlify\functions" --out-extension:.js=.mjs --log-level=warning
if ($LASTEXITCODE -ne 0) { throw "번들링 실패" }

# 4) zip 배포용 netlify.toml (빌드 명령 없음)
#    ※ BOM 이 있으면 Netlify TOML 파서가 거부하므로 BOM 없는 UTF-8 로 저장
$toml = @'
# hodu invest landing - drag & drop(zip) deploy config
[build]
  publish   = "public"
  functions = "netlify/functions"

[[redirects]]
  from = "/admin"
  to   = "/admin.html"
  status = 200

[[redirects]]
  from = "/api/leads"
  to   = "/.netlify/functions/leads"
  status = 200

[[redirects]]
  from = "/api/content"
  to   = "/.netlify/functions/content"
  status = 200

[[redirects]]
  from = "/api/admin/*"
  to   = "/.netlify/functions/admin/:splat"
  status = 200

[[redirects]]
  from = "/api/stats"
  to   = "/.netlify/functions/stats"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options           = "DENY"
    X-Content-Type-Options    = "nosniff"
    Referrer-Policy           = "strict-origin-when-cross-origin"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains"
    Permissions-Policy        = "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    Content-Security-Policy   = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' https://cdn.jsdelivr.net data:; img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'"

[[headers]]
  for = "/api/*"
  [headers.values]
    Cache-Control = "no-store"

[[headers]]
  for = "/admin.html"
  [headers.values]
    Cache-Control = "no-store"
    X-Robots-Tag  = "noindex, nofollow"
'@
[IO.File]::WriteAllText("$dist\netlify.toml", $toml, [Text.UTF8Encoding]::new($false))

# 5) 압축
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "$dist\*" -DestinationPath $zip -Force

Write-Host ""
Write-Host "완료!  $zip" -ForegroundColor Green
Write-Host "→ https://app.netlify.com/drop 에 이 zip 파일을 드래그하세요." -ForegroundColor Green
