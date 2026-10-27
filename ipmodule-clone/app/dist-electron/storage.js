"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupStorageHandlers = setupStorageHandlers;
const electron_1 = require("electron");
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = require("os");
function setupStorageHandlers() {
    electron_1.ipcMain.handle('storage:getCommonDirs', () => ({
        home: (0, os_1.homedir)(),
        documents: (0, path_1.join)((0, os_1.homedir)(), 'Documents'),
        downloads: (0, path_1.join)((0, os_1.homedir)(), 'Downloads'),
        desktop: (0, path_1.join)((0, os_1.homedir)(), 'Desktop'),
    }));
    electron_1.ipcMain.handle('storage:listDir', async (_e, dirPath) => {
        try {
            if (!(0, path_1.isAbsolute)(dirPath))
                return { error: 'Path must be absolute' };
            const entries = (0, fs_1.readdirSync)(dirPath, { withFileTypes: true });
            return entries.map(e => ({ name: e.name, isDir: e.isDirectory(), path: (0, path_1.join)(dirPath, e.name) }));
        }
        catch (err) {
            return { error: err.message };
        }
    });
    electron_1.ipcMain.handle('storage:readFile', async (_e, filePath) => {
        try {
            if (!(0, path_1.isAbsolute)(filePath))
                return { error: 'Path must be absolute' };
            return { content: (0, fs_1.readFileSync)(filePath, 'utf-8') };
        }
        catch (err) {
            return { error: err.message };
        }
    });
    electron_1.ipcMain.handle('storage:selectDocumentFile', async () => {
        const result = await electron_1.dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Documents', extensions: ['pdf', 'docx', 'txt', 'md'] }] });
        return result.canceled ? null : result.filePaths[0];
    });
    electron_1.ipcMain.handle('storage:selectResumeFile', async () => {
        const result = await electron_1.dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Resume', extensions: ['pdf', 'docx', 'txt'] }] });
        return result.canceled ? null : result.filePaths[0];
    });
    electron_1.ipcMain.handle('storage:selectFileStealth', async () => {
        const result = await electron_1.dialog.showOpenDialog({ properties: ['openFile'] });
        return result.canceled ? null : result.filePaths[0];
    });
}
//# sourceMappingURL=storage.js.map