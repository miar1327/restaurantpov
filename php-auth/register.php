<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/mail_helper.php';

if (is_logged_in()) {
    redirect('dashboard.php');
}

$fullName = '';
$email = '';
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $fullName = trim($_POST['full_name'] ?? '');
    $email = strtolower(trim($_POST['email'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');
    $confirmPassword = (string) ($_POST['confirm_password'] ?? '');

    if (!verify_csrf_token($_POST['csrf_token'] ?? '')) {
        $errors[] = 'Your session expired. Please refresh the page and try again.';
    }

    if ($fullName === '') {
        $errors[] = 'Full name is required.';
    }

    if ($email === '') {
        $errors[] = 'Email is required.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Please enter a valid email address.';
    }

    if ($password === '') {
        $errors[] = 'Password is required.';
    } elseif (!is_valid_password($password)) {
        $errors[] = password_rule_text();
    }

    if ($confirmPassword === '') {
        $errors[] = 'Please confirm your password.';
    } elseif ($password !== $confirmPassword) {
        $errors[] = 'Password and confirm password do not match.';
    }

    if (!$errors) {
        $checkUser = db()->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $checkUser->execute(['email' => $email]);

        if ($checkUser->fetch()) {
            $errors[] = 'An account with this email already exists.';
        }
    }

    if (!$errors) {
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);

        if ($passwordHash === false) {
            $errors[] = 'Password hashing failed. Please try again.';
        } else {
            $verificationToken = generate_verification_token();
            $verificationExpiresAt = date(
                'Y-m-d H:i:s',
                strtotime('+' . VERIFICATION_TOKEN_TTL_HOURS . ' hours')
            );

            $insertUser = db()->prepare(
                'INSERT INTO users
                    (full_name, email, password_hash, is_verified, verification_token, verification_expires_at, created_at, updated_at)
                 VALUES
                    (:full_name, :email, :password_hash, 0, :verification_token, :verification_expires_at, NOW(), NOW())'
            );

            $insertUser->execute([
                'full_name' => $fullName,
                'email' => $email,
                'password_hash' => $passwordHash,
                'verification_token' => $verificationToken,
                'verification_expires_at' => $verificationExpiresAt,
            ]);

            $emailSent = send_verification_email($email, $fullName, $verificationToken);

            if ($emailSent) {
                set_flash('success', 'Registration successful. Please check your email and click the verification link.');
            } else {
                set_flash(
                    'warning',
                    'Registration successful, but the verification email could not be sent. Check SMTP settings in config.php.'
                );
            }

            redirect('login.php');
        }
    }
}

$pageTitle = 'Create your account';
$pageDescription = 'Register with your full name, email address, and password.';
require_once __DIR__ . '/partials/header.php';
?>
<section class="card">
    <div class="card-header">
        <h1 class="card-title"><?= h($pageTitle) ?></h1>
        <p class="card-subtitle"><?= h($pageDescription) ?></p>
    </div>

    <?php if ($errors): ?>
        <div class="alert alert-error">
            <ul class="error-list">
                <?php foreach ($errors as $error): ?>
                    <li><?= h($error) ?></li>
                <?php endforeach; ?>
            </ul>
        </div>
    <?php endif; ?>

    <form method="post" novalidate>
        <input type="hidden" name="csrf_token" value="<?= h(get_csrf_token()) ?>">

        <div class="auth-grid">
            <div class="field field-full">
                <label for="full_name">Full Name</label>
                <input
                    type="text"
                    id="full_name"
                    name="full_name"
                    value="<?= h($fullName) ?>"
                    autocomplete="name"
                    required
                >
            </div>

            <div class="field field-full">
                <label for="email">Email Address</label>
                <input
                    type="email"
                    id="email"
                    name="email"
                    value="<?= h($email) ?>"
                    autocomplete="email"
                    required
                >
            </div>

            <div class="field">
                <label for="password">Password</label>
                <input
                    type="password"
                    id="password"
                    name="password"
                    autocomplete="new-password"
                    required
                >
                <p class="helper-text"><?= h(password_rule_text()) ?></p>
            </div>

            <div class="field">
                <label for="confirm_password">Confirm Password</label>
                <input
                    type="password"
                    id="confirm_password"
                    name="confirm_password"
                    autocomplete="new-password"
                    required
                >
            </div>
        </div>

        <div class="form-actions">
            <button type="submit" class="btn btn-primary">Create Account</button>
            <a class="btn btn-secondary" href="<?= h(url('login.php')) ?>">Back to Login</a>
        </div>
    </form>

    <div class="text-links">
        <span class="muted">Already have an account?</span>
        <a href="<?= h(url('login.php')) ?>">Login here</a>
    </div>
</section>
<?php require_once __DIR__ . '/partials/footer.php'; ?>
