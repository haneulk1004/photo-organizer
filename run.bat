@echo off
REM Photo Organizer - Windows 실행 스크립트
REM 이 파일을 더블클릭하면 자동으로 서버가 시작됩니다

echo.
echo ========================================
echo  Photo Organizer 시작 중...
echo ========================================
echo.

REM Node.js 설치 여부 확인
where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo [ERROR] Node.js가 설치되어 있지 않습니다!
    echo.
    echo https://nodejs.org/ 에서 LTS 버전을 설치하고 다시 시도하세요.
    echo.
    pause
    exit /b 1
)

REM npm 패키지 설치 (처음 1회만)
if not exist "node_modules" (
    echo [1/2] 패키지 설치 중...
    call npm install
    echo.
)

REM 서버 시작
echo [2/2] 서버 시작 중...
echo.
echo ========================================
echo  ✅ Photo Organizer 실행 중!
echo.
echo  👉 브라우저에서 열기:
echo     http://localhost:3000
echo.
echo  ⚠️  이 창을 닫으면 서버가 중지됩니다.
echo  (Ctrl+C 로도 종료 가능)
echo ========================================
echo.

call npm start
