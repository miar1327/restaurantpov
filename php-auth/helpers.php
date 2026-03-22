<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

/*
|--------------------------------------------------------------------------
| Shared Helper Functions
|--------------------------------------------------------------------------
| These helpers are reused across registration, login, reset password,
| protected pages, and email links.
*/

function start_secure_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $isHttps = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';

    session_name(SESSION_NAME);
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_secure', $isHttps ? '1' : '0');
    ini_set('session.cookie_samesite', 'Lax');

    session_start();
}

function url(string $path = ''): string
{
    $base = rtrim(BASE_URL, '/');
    $path = ltrim($path, '/');

    return $path === '' ? $base : $base . '/' . $path;
}

function redirect(string $path): void
{
    $target = preg_match('#^https?://#i', $path) ? $path : url($path);
    header('Location: ' . $target);
    exit;
}

function h(?string $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function set_flash(string $type, string $message): void
{
    $_SESSION['flash_messages'][] = [
        'type' => $type,
        'message' => $message,
    ];
}

function get_flash_messages(): array
{
    $messages = $_SESSION['flash_messages'] ?? [];
    unset($_SESSION['flash_messages']);
    return $messages;
}

function get_csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    return $_SESSION['csrf_token'];
}

function verify_csrf_token(?string $submittedToken): bool
{
    if (empty($_SESSION['csrf_token']) || empty($submittedToken)) {
        return false;
    }

    return hash_equals($_SESSION['csrf_token'], $submittedToken);
}

function generate_verification_token(): string
{
    return bin2hex(random_bytes(32));
}

function generate_reset_code(): string
{
    return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
}

function is_valid_password(string $password): bool
{
    $hasMinimumLength = strlen($password) >= 8;
    $hasLetter = (bool) preg_match('/[A-Za-z]/', $password);
    $hasNumber = (bool) preg_match('/\d/', $password);

    return $hasMinimumLength && $hasLetter && $hasNumber;
}

function password_rule_text(): string
{
    return 'Password must be at least 8 characters long and include at least one letter and one number.';
}

function is_logged_in(): bool
{
    return !empty($_SESSION['user']['id']);
}

function current_user(): ?array
{
    return $_SESSION['user'] ?? null;
}

function login_user(array $user): void
{
    session_regenerate_id(true);

    $_SESSION['user'] = [
        'id' => (int) $user['id'],
        'full_name' => $user['full_name'],
        'email' => $user['email'],
    ];
}

function logout_user(): void
{
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'],
            $params['domain'],
            (bool) $params['secure'],
            (bool) $params['httponly']
        );
    }

    session_destroy();
}

start_secure_session();
