<?php
declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Application Configuration
|--------------------------------------------------------------------------
| Update these placeholders before deploying to Hostinger.
| BASE_URL should point to the folder where this PHP auth module lives.
| When using Hostinger SMTP, the sender email should be a mailbox from
| your own domain, such as noreply@yourdomain.com.
| A Gmail address can still be used as the account that receives emails.
*/

define('APP_NAME', 'Restaurant Website');

define('BASE_URL', 'http://127.0.0.1:8080');

define('DB_HOST', 'localhost');
define('DB_NAME', 'restauth_7f48c69a0d');
define('DB_USER', 'user_39dde017');
define('DB_PASS', 'd99ed942fa486888ff505b7e3efff904');

define('SMTP_HOST', 'smtp.hostinger.com');
define('SMTP_PORT', 465);
define('SMTP_USERNAME', 'mailer_0681281b@example.com');
define('SMTP_PASSWORD', '52a3ccc0ad7ab02dcd32d8ea4b8566c6');
define('SMTP_FROM_EMAIL', 'mailer_0681281b@example.com');
define('SMTP_FROM_NAME', 'Restaurant Website');

define('VERIFICATION_TOKEN_TTL_HOURS', 24);
define('RESET_CODE_TTL_MINUTES', 15);
define('SESSION_NAME', 'restaurant_auth_session');

date_default_timezone_set('UTC');

error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
