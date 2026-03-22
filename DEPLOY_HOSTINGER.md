# Deploying Restaurant POV on Hostinger Business Web Hosting

This project is prepared for Hostinger's supported stack:

- Frontend: React + Vite
- Backend: Express
- Database: MySQL / MariaDB

## 1. Before you start

Have these ready:

- your Hostinger Business Web Hosting account
- a connected domain or subdomain
- a GitHub repo or project zip
- a Resend account for reset emails
- a strong random secret for `AUTH_SECRET`

## 2. Create the MySQL database

In Hostinger hPanel:

1. Open `Websites` -> your site -> `Databases` -> `MySQL Databases`
2. Create a database
3. Create a database user
4. Save these exact values:
   - database host
   - database name
   - database username
   - database password
   - database port, usually `3306`

## 3. Create the Node.js app in Hostinger

In hPanel:

1. Open `Websites`
2. Choose `Add website`
3. Choose `Node.js`
4. Connect your GitHub repo or upload the project

Use these app settings:

```text
Node version: 22.x
Build command: npm install && npm run build
Start command: npm run start
Port: 3000
```

If Hostinger asks for an application root, use the repository root where `package.json` lives.

## 4. Add environment variables

In the Node.js app environment settings, add:

```text
AUTH_SECRET=your-long-random-secret
RESEND_API_KEY=your-resend-key
RESEND_FROM_EMAIL=Restaurant POV <noreply@yourdomain.com>
MYSQL_HOST=your-mysql-host
MYSQL_PORT=3306
MYSQL_USER=your-mysql-user
MYSQL_PASSWORD=your-mysql-password
MYSQL_DATABASE=your-mysql-database
MYSQL_SSL=false
PORT=3000
```

Notes:

- `AUTH_SECRET` must be long and random. The app refuses to boot in production if it is missing or weak.
- `RESEND_FROM_EMAIL` should use a verified sender/domain in Resend.
- If Hostinger gives you an SSL-only MySQL connection requirement, set `MYSQL_SSL=true`.

## 5. Deploy

After the env vars are saved:

1. trigger a new deployment
2. wait for the build to finish
3. open the app URL

On first boot, the app creates the required MySQL tables automatically.

## 6. Map the main Hostinger fields

Use this quick mapping inside hPanel:

```text
Website type       -> Node.js App
Application root   -> project root
Node version       -> 22.x
Install command    -> npm install
Build command      -> npm run build
Start command      -> npm run start
App port           -> 3000
```

If Hostinger only provides one command field for build, use:

```text
npm install && npm run build
```

## 7. First production checks

After deployment, confirm:

1. the landing page opens
2. you can create a restaurant profile
3. restaurant data persists after refresh
4. a second browser sees the same live orders
5. password reset email arrives

## 8. Troubleshooting

If you see `AUTH_SECRET is missing or insecure`:

- set a strong `AUTH_SECRET` in Hostinger env vars
- redeploy

If you see `Email delivery is not configured`:

- add `RESEND_API_KEY`
- make sure `RESEND_FROM_EMAIL` is valid
- redeploy

If login works but data is not shared:

- check that all `MYSQL_*` env vars are set correctly
- redeploy and verify the database credentials

If the app boots but looks blank:

- check the build logs
- make sure the build command ran successfully
- verify the app is running from the repo root

## 9. Important behavior notes

- If MySQL env vars are present, the app uses MySQL automatically.
- If MySQL env vars are missing, the app falls back to local JSON files. That is useful for local development, but not recommended for hosted production.
- Existing legacy SHA-256 credential hashes are still accepted during migration, while new credentials are stored with bcrypt.
