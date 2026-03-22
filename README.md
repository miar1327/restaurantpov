# Restaurant POV

Restaurant POV is a local-first restaurant order and role-management app built with React, Vite, and a lightweight Node server.

## Web App

Install dependencies and run the browser version:

```bash
npm install
npm run dev
```

Create a production web build:

```bash
npm run build
npm run start
```

Before `npm run start`, create a root `.env` file with a strong `AUTH_SECRET` because production mode refuses to boot with a missing or weak secret:

```bash
cp .env.example .env
```

## Windows Desktop App

The project now includes an Electron wrapper so the same codebase can run as an offline desktop app on Windows.

### Run the desktop app locally

```bash
npm install
npm run desktop:dev
```

This builds the Vite frontend, starts the local bundled server, and opens the app in an Electron window.

### Package a Windows executable

Run this on a Windows machine:

```bash
npm install
npm run desktop:dist
```

The packaged output will be created in:

```text
release/
```

The current configuration builds a portable Windows executable.

## Local Data Storage

In the browser/dev workflow, the app stores data in the project's `data/` folder.

In the desktop app, the server stores data in the user's app data directory instead, so packaged builds can save orders safely:

```text
%APPDATA%/Restaurant POV/data
```

## Important Offline Note

The desktop app itself works locally, but the email reset flow still depends on Resend. Without internet access and a configured `RESEND_API_KEY`, reset emails will not send.
