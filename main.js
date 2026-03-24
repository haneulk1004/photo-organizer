const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow;
let server;

// Express 서버 시작
function startServer() {
  return new Promise((resolve) => {
    const express = require('express');
    const fs = require('fs');
    const exifr = require('exifr');
    const cors = require('cors');

    const appExpress = express();
    appExpress.use(express.json());
    appExpress.use(cors());
    
    // 정적 파일 서버 경로를 절대 경로로 설정
    const publicPath = path.join(__dirname, 'public');
    appExpress.use(express.static(publicPath));

    // 명시적인 루트 라우트 추가
    appExpress.get('/', (req, res) => {
      res.sendFile(path.join(publicPath, 'index.html'));
    });

    // ─────────────────────────────────────────
    // 유틸: 날짜 → { year, month } 추출
    // ─────────────────────────────────────────
    function extractDate(filePath, stat) {
      const mtime = stat.mtime;
      return {
        year: String(mtime.getFullYear()),
        month: String(mtime.getMonth() + 1).padStart(2, '0'),
      };
    }

    // EXIF 날짜 추출 (JPG/JPEG/HEIC 등)
    async function getExifDate(filePath) {
      try {
        const exif = await exifr.parse(filePath, { pick: ['DateTimeOriginal', 'CreateDate'] });
        if (exif && (exif.DateTimeOriginal || exif.CreateDate)) {
          const d = exif.DateTimeOriginal || exif.CreateDate;
          return {
            year: String(d.getFullYear()),
            month: String(d.getMonth() + 1).padStart(2, '0'),
          };
        }
      } catch (_) {
        // EXIF 없으면 무시
      }
      return null;
    }

    // ─────────────────────────────────────────
    // 유틸: 폴더 내 파일 재귀 수집
    // ─────────────────────────────────────────
    function collectFiles(dir, baseDir, results = []) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          collectFiles(fullPath, baseDir, results);
        } else if (entry.isFile()) {
          results.push(fullPath);
        }
      }
      return results;
    }

    // ─────────────────────────────────────────
    // API: 폴더 스캔 (미리보기)
    // ─────────────────────────────────────────
    appExpress.post('/api/scan', async (req, res) => {
      const { folderPath } = req.body;

      if (!folderPath || !fs.existsSync(folderPath)) {
        return res.status(400).json({ error: '폴더 경로가 없거나 존재하지 않아요.' });
      }

      try {
        const allFiles = collectFiles(folderPath, folderPath);
        const preview = [];

        for (const filePath of allFiles) {
          const stat = fs.statSync(filePath);
          if (!stat.isFile()) continue;

          const fileName = path.basename(filePath);

          // EXIF 우선, 없으면 수정일 사용
          let dateInfo = await getExifDate(filePath);
          const dateSource = dateInfo ? 'EXIF' : '수정일';
          if (!dateInfo) dateInfo = extractDate(filePath, stat);

          const { year, month } = dateInfo;
          const destRelative = path.join(year, month, fileName);
          const destFull = path.join(folderPath, destRelative);
          const alreadyThere = filePath === destFull;

          preview.push({
            from: filePath,
            fromRelative: path.relative(folderPath, filePath),
            to: destFull,
            toRelative: destRelative,
            year,
            month,
            dateSource,
            alreadyThere,
            size: stat.size,
          });
        }

        const toMove = preview.filter(f => !f.alreadyThere);
        res.json({ total: preview.length, toMove: toMove.length, files: preview });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ─────────────────────────────────────────
    // API: 실제 파일 이동
    // ─────────────────────────────────────────
    appExpress.post('/api/organize', async (req, res) => {
      const { folderPath, files } = req.body;

      if (!folderPath || !files || !Array.isArray(files)) {
        return res.status(400).json({ error: '잘못된 요청이에요.' });
      }

      const results = { success: [], skipped: [], failed: [] };

      for (const file of files) {
        if (file.alreadyThere) {
          results.skipped.push(file.fromRelative);
          continue;
        }

        try {
          const destDir = path.dirname(file.to);
          fs.mkdirSync(destDir, { recursive: true });

          // 같은 이름 파일이 목적지에 있으면 번호 붙이기
          let destPath = file.to;
          let counter = 1;
          while (fs.existsSync(destPath)) {
            const ext = path.extname(file.to);
            const base = path.basename(file.to, ext);
            destPath = path.join(path.dirname(file.to), `${base}_${counter}${ext}`);
            counter++;
          }

          fs.renameSync(file.from, destPath);
          results.success.push({ from: file.fromRelative, to: path.relative(folderPath, destPath) });
        } catch (err) {
          results.failed.push({ file: file.fromRelative, reason: err.message });
        }
      }

      // 빈 폴더 정리
      try {
        cleanEmptyDirs(folderPath);
      } catch (_) {}

      res.json(results);
    });

    // ─────────────────────────────────────────
    // 유틸: 빈 폴더 재귀 삭제
    // ─────────────────────────────────────────
    function cleanEmptyDirs(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const sub = path.join(dir, entry.name);
          cleanEmptyDirs(sub);
          if (fs.readdirSync(sub).length === 0) {
            fs.rmdirSync(sub);
          }
        }
      }
    }

    // ─────────────────────────────────────────
    // 서버 시작
    // ─────────────────────────────────────────
    server = appExpress.listen(3000, () => {
      console.log('✅ Photo Organizer 백엔드 실행 중 (포트 3000)');
      resolve();
    });
  });
}

// IPC 핸들러: 폴더 선택 대화상자
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// Electron 윈도우 생성
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'public/icon.png'),
  });

  // 개발자 도구 자동 열기 (선택사항)
  // mainWindow.webContents.openDevTools();

  mainWindow.loadURL('http://localhost:3000');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Electron 앱 준비
app.on('ready', async () => {
  await startServer();
  setTimeout(() => {
    createWindow();
  }, 500);
});

// 모든 윈도우가 닫혔을 때 앱 종료
app.on('window-all-closed', () => {
  if (server) {
    server.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// macOS에서 Dock 아이콘 클릭 시 윈도우 다시 열기
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// 예기치 않은 종료 처리
process.on('exit', () => {
  if (server) {
    server.close();
  }
});
