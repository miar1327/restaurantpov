# PHP Authentication Module for Hostinger

This folder contains a complete beginner-friendly authentication system built for:

- PHP 8+
- MySQL
- PHPMailer
- Hostinger shared hosting

## Folder Structure

```text
php-auth/
├── assets/
│   └── auth.css
├── partials/
│   ├── footer.php
│   └── header.php
├── auth_schema.sql
├── composer.json
├── config.php
├── dashboard.php
├── db.php
├── forgot-password.php
├── helpers.php
├── index.php
├── login.php
├── logout.php
├── mail_helper.php
├── register.php
├── reset-password.php
├── setup-database.php
├── session_check.php
└── verify-email.php
```

## What Each File Does

- `config.php`
  - Stores `BASE_URL`, database credentials, SMTP credentials, and auth settings.
- `db.php`
  - Creates one reusable PDO connection with prepared statements.
- `helpers.php`
  - Handles sessions, CSRF tokens, redirects, flash messages, password rules, and common helpers.
- `mail_helper.php`
  - Sends verification emails and password reset code emails using PHPMailer and Hostinger SMTP.
- `session_check.php`
  - Protects pages like `dashboard.php`.
- `register.php`
  - Registration workflow with email verification token.
- `verify-email.php`
  - Verifies accounts with a clickable email token.
- `login.php`
  - Verified-user login using `password_verify()`.
- `forgot-password.php`
  - Sends a 6-digit reset code by email.
- `reset-password.php`
  - Verifies email + code + expiry, then resets the password.
- `logout.php`
  - Destroys the session and redirects to login.
- `dashboard.php`
  - Example protected page after successful login.
- `setup-database.php`
  - One-click installer that creates the `users` table from `auth_schema.sql`.
- `auth_schema.sql`
  - MySQL table structure.
- `composer.json`
  - Installs PHPMailer.

## SQL Setup

1. Create a MySQL database in Hostinger hPanel.
2. Open phpMyAdmin and note your real database credentials.
3. Update `config.php` with the real Hostinger MySQL values.
4. Choose one of these database setup methods:
   - Import `auth_schema.sql` in phpMyAdmin.
   - Or visit `setup-database.php` once and let the app create the table for you.

## Install PHPMailer

### Option 1: Install locally and upload `vendor/`

Run this command inside the `php-auth` folder:

```bash
composer install --no-dev --optimize-autoloader
```

Then upload the whole `php-auth` folder including:

- `vendor/`
- `composer.lock` if Composer creates it

### Option 2: Install with SSH on Hostinger

If your Hostinger plan has SSH access:

```bash
cd public_html/php-auth
composer install --no-dev --optimize-autoloader
```

## Configure `config.php`

Open `config.php` and update these placeholders:

```php
define('BASE_URL', 'https://your-domain.com/php-auth');

define('DB_HOST', 'localhost');
define('DB_NAME', 'your_database_name');
define('DB_USER', 'your_database_user');
define('DB_PASS', 'your_database_password');

define('SMTP_HOST', 'smtp.hostinger.com');
define('SMTP_PORT', 465);
define('SMTP_USERNAME', 'noreply@yourdomain.com');
define('SMTP_PASSWORD', 'your_email_password');
define('SMTP_FROM_EMAIL', 'noreply@yourdomain.com');
define('SMTP_FROM_NAME', 'Restaurant Website');
```

Important:

- A Gmail address can be the account that receives verification emails.
- If you are using Hostinger SMTP, the sender account should still be a real mailbox on your own domain, such as `noreply@yourdomain.com`.

## Where to Update `BASE_URL`

Update `BASE_URL` in:

- `php-auth/config.php`

Examples:

- If uploaded to `public_html/` root:
  - `https://your-domain.com`
- If uploaded to `public_html/php-auth/`:
  - `https://your-domain.com/php-auth`

## Hostinger SMTP Configuration

Create a domain email account in Hostinger first, for example:

- `noreply@yourdomain.com`

Then use:

- `SMTP_HOST = smtp.hostinger.com`
- `SMTP_PORT = 465`
- `SMTP_USERNAME = full email address`
- `SMTP_PASSWORD = that mailbox password`
- `SMTP_FROM_EMAIL = same domain email address`
- `SMTP_FROM_NAME = your website or restaurant name`

Port choices:

- `465` for SSL
- `587` for TLS

This project automatically uses:

- SSL when `SMTP_PORT` is `465`
- TLS when `SMTP_PORT` is `587`

## How to Upload to Hostinger Shared Hosting

1. Open Hostinger hPanel.
2. Go to `Files` -> `File Manager`.
3. Open `public_html`.
4. Upload the `php-auth` folder or upload the files directly into `public_html`.
5. If you upload to a subfolder, keep the folder name in `BASE_URL`.
6. Import `auth_schema.sql` in phpMyAdmin.
7. Or open `setup-database.php` once after `config.php` is updated.
8. Install PHPMailer with Composer or upload the `vendor` folder.
9. Update `config.php`.
10. Delete `setup-database.php` after the table is created.
11. Visit:

```text
https://your-domain.com/php-auth/register.php
```

or if uploaded directly to root:

```text
https://your-domain.com/register.php
```

## Authentication Workflows Included

### Registration

- Full name, email, password, confirm password
- Validation
- Email uniqueness check
- Password hashing with `password_hash()`
- Unverified account creation
- Verification token generation
- Expiry timestamp saving
- Verification email sending

### Email Verification

- Clickable token link
- Token validation
- Expiry check
- Account verification
- Token cleanup

### Login

- Email + password validation
- `password_verify()`
- Verified-account check
- Secure session start
- Redirect to `dashboard.php`

### Forgot Password

- Email input
- 6-digit reset code generation
- Code expiry saving
- Reset code email sending
- Neutral response for security

### Reset Password

- Email + code + new password + confirm password
- Input validation
- Code expiry check
- Password update
- Reset code cleanup

### Logout

- Secure session destruction
- Redirect back to login

## Beginner Notes

- All database queries use PDO prepared statements.
- Passwords are never stored in plain text.
- CSRF tokens are added to every form.
- Flash messages are used for success and error feedback.
- `session_check.php` protects private pages.

## Suggested Next Improvements

- Add resend verification flow
- Add rate limiting
- Add login attempt throttling
- Add remember me functionality
- Add audit logs
- Move config values to environment variables if your hosting supports them
