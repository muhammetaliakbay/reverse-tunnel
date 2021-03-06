import {app, BrowserWindow} from 'electron';
import {Color, Titlebar} from 'custom-electron-titlebar';

function createWindow () {
    // Create the browser window.
    const win = new BrowserWindow({
        width: 1920/2,
        height: 1080/2,
        webPreferences: {
            nodeIntegration: true,
        },
        // frame: false,
        title: 'Reverse Tunnel Manager',
    });

    // and load the index.html of the app.
    win.loadFile('./bundle/index.html');

    // Open the DevTools.
    if (process.argv.includes('--dev')) {
        win.webContents.openDevTools();
    }
    win.removeMenu();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

process.on('uncaughtException', error =>
    console.error('uncaughtException on main', error)
);
process.on('unhandledRejection', reason =>
    console.error('unhandledRejection on main', reason)
);
