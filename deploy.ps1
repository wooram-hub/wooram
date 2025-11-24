# 자동 커밋 및 푸시 스크립트
# 사용법: .\deploy.ps1 "커밋 메시지"

param(
    [string]$message = "Auto commit and push"
)

# PATH 환경변수 업데이트
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host "🚀 자동 배포 시작..." -ForegroundColor Green
Write-Host ""

# Git 상태 확인
Write-Host "📊 변경사항 확인 중..." -ForegroundColor Yellow
$status = git status --short

if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "✅ 커밋할 변경사항이 없습니다." -ForegroundColor Green
    exit 0
}

Write-Host "변경된 파일:" -ForegroundColor Cyan
git status --short

# 모든 파일 추가
Write-Host ""
Write-Host "📦 파일 스테이징 중..." -ForegroundColor Yellow
git add .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 파일 추가 실패" -ForegroundColor Red
    exit 1
}

# 커밋
Write-Host "💾 커밋 중..." -ForegroundColor Yellow
git commit -m $message

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 커밋 실패" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 커밋 완료: $message" -ForegroundColor Green

# 푸시
Write-Host ""
Write-Host "☁️  GitHub에 푸시 중..." -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 푸시 실패" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ 배포 완료!" -ForegroundColor Green
Write-Host "📌 Cloudflare Pages에 자동 배포됩니다." -ForegroundColor Cyan
Write-Host ""

