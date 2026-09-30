import { app, BrowserWindow, session } from 'electron';
import { createSkillServer } from '../src/server.mjs';

let server;
let origin;
let closingServer = false;

function openWindow() {
  const window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'Skill Manager',
    backgroundColor: '#f6f6f3',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, navigationUrl) => {
    if (navigationUrl !== `${origin}/`) event.preventDefault();
  });
  window.loadURL(origin);
}

async function start() {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  ({ server } = await createSkillServer({ dataDir: app.getPath('userData') }));
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });
  } catch (error) {
    server = undefined;
    throw error;
  }
  origin = `http://127.0.0.1:${server.address().port}`;
  openWindow();
}

app.whenReady().then(start).catch((error) => {
  console.error(error);
  app.quit();
});

app.on('activate', () => {
  if (!closingServer && server?.listening && origin && BrowserWindow.getAllWindows().length === 0) {
    openWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', (event) => {
  if (!server || closingServer) return;
  event.preventDefault();
  closingServer = true;
  origin = undefined;
  const timeout = setTimeout(() => app.exit(0), 3000);
  server.close(() => {
    clearTimeout(timeout);
    app.exit(0);
  });
  server.closeAllConnections();
});
