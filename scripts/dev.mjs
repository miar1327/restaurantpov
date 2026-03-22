import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const VITE_BIN = path.join(ROOT_DIR, 'node_modules', 'vite', 'bin', 'vite.js');
const AUTH_SERVER = path.join(ROOT_DIR, 'server', 'index.mjs');

const children = [];
let shuttingDown = false;

const shutdown = (code = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;

    for (const child of children) {
        if (!child.killed) {
            child.kill('SIGTERM');
        }
    }

    setTimeout(() => process.exit(code), 50);
};

const spawnChild = (args, env = {}) => {
    const child = spawn(process.execPath, args, {
        cwd: ROOT_DIR,
        env: { ...process.env, ...env },
        stdio: 'inherit',
    });

    children.push(child);

    child.on('exit', (code, signal) => {
        if (shuttingDown || signal === 'SIGTERM') return;
        if (code && code !== 0) {
            shutdown(code);
        }
    });

    return child;
};

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const devApiPort = process.env.AUTH_SERVER_PORT || '8787';

spawnChild(['--watch', AUTH_SERVER], {
    AUTH_SERVER_PORT: devApiPort,
    PORT: devApiPort,
});
spawnChild([VITE_BIN, '--host', '0.0.0.0']);
