const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  fetchNextMatch: (teamName) => ipcRenderer.invoke('fetch-next-match', teamName),
  fetchNextMatches: (teamName) => ipcRenderer.invoke('fetch-next-matches', teamName),
  getTeamNames: () => ipcRenderer.invoke('get-team-names'),
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
});
