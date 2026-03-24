#!/bin/bash
# Photo Organizer - macOS/Linux 실행 스크립트
# 터미널에서 ./run.sh 로 실행하세요

echo ""
echo "========================================"
echo "  Photo Organizer (macOS/Linux)"
echo "  준비 및 실행을 시작합니다..."
echo "========================================"
echo ""

# Node.js 설치 여부 확인
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js가 설치되어 있지 않습니다!"
    echo ""
    echo "다음 중 하나를 선택하여 설치하세요:"
    echo "- https://nodejs.org/ (공식 사이트)"
    echo "- brew install node (macOS의 경우)"
    echo ""
    exit 1
fi

# npm 패키지 설치 (처음 1회만)
if [ ! -d "node_modules" ]; then
    echo "[1/2] 패키지 설치 중..."
    npm install
    echo ""
fi

# 서버 시작
echo "[2/2] 서버 시작 중..."
echo ""
echo "========================================"
echo "  ✅ Photo Organizer 실행 중!"
echo ""
echo "  👉 브라우저에서 열기:"
echo "     http://localhost:3000"
echo ""
echo "  ⚠️  Ctrl+C 로 서버를 중지할 수 있습니다."
echo "========================================"
echo ""

# 의존성 확인 루틴 (선택사항: npm start가 실패할 경우 안내)
if [ ! -d "node_modules" ]; then
    echo "[FAIL] node_modules를 생성할 수 없습니다. npm install을 직접 실행해 보세요."
    exit 1
fi

# 앱 실행
npm start
