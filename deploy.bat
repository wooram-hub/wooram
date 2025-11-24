@echo off
REM 자동 커밋 및 푸시 배치 스크립트
REM 사용법: deploy.bat "커밋 메시지"

setlocal

if "%1"=="" (
    set "COMMIT_MSG=Auto commit and push"
) else (
    set "COMMIT_MSG=%1"
)

echo 🚀 자동 배포 시작...
echo.

echo 📊 변경사항 확인 중...
git status --short
if errorlevel 1 (
    echo ❌ Git 상태 확인 실패
    exit /b 1
)

echo.
echo 📦 파일 스테이징 중...
git add .
if errorlevel 1 (
    echo ❌ 파일 추가 실패
    exit /b 1
)

echo 💾 커밋 중...
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo ❌ 커밋 실패
    exit /b 1
)

echo ✅ 커밋 완료: %COMMIT_MSG%

echo.
echo ☁️  GitHub에 푸시 중...
git push origin main
if errorlevel 1 (
    echo ❌ 푸시 실패
    exit /b 1
)

echo.
echo ✅ 배포 완료!
echo 📌 Cloudflare Pages에 자동 배포됩니다.
echo.

endlocal

