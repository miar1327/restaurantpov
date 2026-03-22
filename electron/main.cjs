const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('node:child_process');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

const SERVER_PORT = Number(process.env.PORT || 3210);
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;
const SERVER_START_TIMEOUT_MS = 15000;

let mainWindow = null;
let serverProcess = null;
let appQuitting = false;

const getServerEntry = () => path.join(app.getAppPath(), 'server', 'index.mjs');
const getDesktopDataDir = () => path.join(app.getPath('userData'), 'data');
const getDesktopSecretPath = () => path.join(app.getPath('userData'), 'auth-secret.txt');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ensureDesktopAuthSecret = () => {
    const secretPath = getDesktopSecretPath();

    if (existsSync(secretPath)) {
        const existingSecret = readFileSync(secretPath, 'utf8').trim();
        if (existingSecret) return existingSecret;
    }

    mkdirSync(path.dirname(secretPath), { recursive: true });
    const nextSecret = randomBytes(48).toString('hex');
    writeFileSync(secretPath, `${nextSecret}\n`, 'utf8');
    return nextSecret;
};

const pingServer = () => new Promise((resolve, reject) => {
    const req = http.get(`${SERVER_URL}/api/health`, (res) => {
        if (res.statusCode === 200) {
            res.resume();
            resolve();
            return;
        }

        res.resume();
        reject(new Error(`Health check returned status ${res.statusCode}.`));
    });

    req.on('error', reject);
    req.setTimeout(2000, () => {
        req.destroy(new Error('Health check timed out.'));
    });
});

const waitForServer = async () => {
    const startedAt = Date.now();

    while (Date.now() - startedAt < SERVER_START_TIMEOUT_MS) {
        try {
            await pingServer();
            return;
        } catch {
            await delay(250);
        }
    }

    throw new Error('The local Restaurant POV server did not start in time.');
};

const startLocalServer = async () => {
    if (serverProcess) return;

    serverProcess = spawn(
        process.execPath,
        [getServerEntry(), '--prod'],
        {
            env: {
                ...process.env,
                ELECTRON_RUN_AS_NODE: '1',
                PORT: String(SERVER_PORT),
                RESTAURANTPOV_DATA_DIR: getDesktopDataDir(),
                AUTH_SECRET: process.env.AUTH_SECRET || ensureDesktopAuthSecret(),
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        },
    );

    serverProcess.stdout?.on('data', (chunk) => {
        process.stdout.write(`[desktop-server] ${chunk}`);
    });

    serverProcess.stderr?.on('data', (chunk) => {
        process.stderr.write(`[desktop-server] ${chunk}`);
    });

    serverProcess.on('exit', (code, signal) => {
        const details = code != null ? `code ${code}` : `signal ${signal}`;
        serverProcess = null;

        if (!appQuitting) {
            dialog.showErrorBox(
                'Restaurant POV',
                `The local server stopped unexpectedly (${details}).`,
            );
            if (!mainWindow?.isDestroyed()) {
                mainWindow?.close();
            }
        }
    });

    await waitForServer();
};

const stopLocalServer = () => {
    if (!serverProcess) return;

    serverProcess.kill();
    serverProcess = null;
};

const createMainWindow = async () => {
    await startLocalServer();

    mainWindow = new BrowserWindow({
        width: 1440,
        height: 920,
        minWidth: 1200,
        minHeight: 760,
        autoHideMenuBar: true,
        backgroundColor: '#0d0f14',
        show: false,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    await mainWindow.loadURL(SERVER_URL);
};

app.whenReady().then(async () => {
    try {
        await createMainWindow();
    } catch (error) {
        dialog.showErrorBox(
            'Restaurant POV',
            error?.message || 'Unable to start the desktop app.',
        );
        app.quit();
    }

    app.on('activate', async () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            try {
                await createMainWindow();
            } catch (error) {
                dialog.showErrorBox(
                    'Restaurant POV',
                    error?.message || 'Unable to restore the desktop app window.',
                );
                app.quit();
            }
        }
    });
});

app.on('before-quit', () => {
    appQuitting = true;
    stopLocalServer();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
