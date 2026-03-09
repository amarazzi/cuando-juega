const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { fetchNextMatch, getTeamNames } = require('./src/fetcher');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 640,
    frame: false,
    transparent: false,
    resizable: true,
    backgroundColor: '#000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('fetch-next-match', async (_event, teamName) => {
  try {
    const match = await fetchNextMatch(teamName);
    return { success: true, data: match };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-team-names', async () => {
  return getTeamNames();
});

ipcMain.handle('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-close', () => {
  if (mainWindow) mainWindow.close();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
