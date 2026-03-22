/**
 * Express server entry point.
 * Keeps the existing API contract while using a Hostinger-friendly Node stack.
 */
import express from 'express';
import path from 'node:path';
import { PORT, HOST, IS_PROD, DIST_DIR } from './config.mjs';
import { sendJson, httpError } from './utils.mjs';
import { handleProfiles } from './routes/profiles.mjs';
import { handleAuth } from './routes/auth.mjs';
import { handleApp } from './routes/app.mjs';

const app = express();

app.disable('x-powered-by');

app.use(async (req, res, next) => {
    try {
        const pathname = req.path;

        if (pathname.startsWith('/api/')) {
            if (await handleApp(req, res, pathname)) return;
            if (await handleAuth(req, res, pathname)) return;
            if (await handleProfiles(req, res, pathname)) return;
            throw httpError(404, 'Not found.');
        }

        if (IS_PROD) {
            next();
            return;
        }

        throw httpError(404, 'Not found.');
    } catch (error) {
        next(error);
    }
});

if (IS_PROD) {
    app.use(express.static(DIST_DIR));

    app.get('/{*path}', (req, res, next) => {
        res.sendFile(path.join(DIST_DIR, 'index.html'), (error) => {
            if (error) next(error);
        });
    });
}

app.use((error, req, res, _next) => {
    const statusCode = error.statusCode ?? 500;
    const message = error.message ?? 'Internal server error.';
    if (statusCode >= 500) {
        console.error(error);
    }

    if (!res.headersSent) {
        sendJson(res, statusCode, { error: message });
    }
});

app.listen(PORT, HOST, () => {
    console.log(
        IS_PROD
            ? `Restaurant POV server listening on http://${HOST}:${PORT}`
            : `Restaurant POV auth API listening on http://${HOST}:${PORT}`,
    );
});
