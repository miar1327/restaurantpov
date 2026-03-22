<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

$email = strtolower(trim($_GET['email'] ?? ''));
$code = '';
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim($_POST['email'] ?? ''));
    $code = preg_replace('/\D+/', '', (string) ($_POST['code'] ?? ''));
    $newPassword = (string) ($_POST['new_password'] ?? '');
    $confirmNewPassword = (string) ($_POST['confirm_new_password'] ?? '');

    if (!verify_csrf_token($_POST['csrf_token'] ?? '')) {
        $errors[] = 'Your session expired. Please refresh the page and try again.';
    }

    if ($email === '') {
        $errors[] = 'Email is required.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Please enter a valid email address.';
    }

    if ($code === '' || strlen($code) !== 6) {
        $errors[] = 'Please enter the 6-digit reset code.';
    }

    if ($newPassword === '') {
        $errors[] = 'New password is required.';
    } elseif (!is_valid_password($newPassword)) {
        $errors[] = password_rule_text();
    }

    if ($confirmNewPassword === '') {
        $errors[] = 'Please confirm your new password.';
    } elseif ($newPassword !== $confirmNewPassword) {
        $errors[] = 'New password and confirm password do not match.';
    }

    if (!$errors) {
        $findUser = db()->prepare(
            'SELECT id
             FROM users
             WHERE email = :email
               AND reset_code = :reset_code
               AND reset_code_expires_at IS NOT NULL
               AND reset_code_expires_at >= NOW()
             LIMIT 1'
        );

        $findUser->execute([
            'email' => $email,
            'reset_code' => $code,
        ]);

        $user = $findUser->fetch();

        if (!$user) {
            $errors[] = 'The reset code is invalid or has expired.';
        } else {
            $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);

            if ($passwordHash === false) {
                $errors[] = 'Password hashing failed. Please try again.';
            } else {
                $updatePassword = db()->prepare(
                    'UPDATE users
                     SET password_hash = :password_hash,
                         reset_code = NULL,
                         reset_code_expires_at = NULL,
                         updated_at = NOW()
                     WHERE id = :id'
                );

                $updatePassword->execute([
                    'password_hash' => $passwordHash,
                    'id' => $user['id'],
                ]);

                set_flash('success', 'Your password has been reset successfully. You can now log in.');
                redirect('login.php?email=' . urlencode($email));
            }
        }
    }
}

$pageTitle = 'Reset Password';
$pageDescription = 'Enter your email, the 6-digit reset code, and your new password.';
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

            <div class="field field-full">
                <label for="code">6-Digit Reset Code</label>
                <input
                    type="text"
                    id="code"
                    name="code"
                    value="<?= h($code) ?>"
                    inputmode="numeric"
                    maxlength="6"
                    required
                >
            </div>

            <div class="field">
                <label for="new_password">New Password</label>
                <input
                    type="password"
                    id="new_password"
                    name="new_password"
                    autocomplete="new-password"
                    required
                >
                <p class="helper-text"><?= h(password_rule_text()) ?></p>
            </div>

            <div class="field">
                <label for="confirm_new_password">Confirm New Password</label>
                <input
                    type="password"
                    id="confirm_new_password"
                    name="confirm_new_password"
                    autocomplete="new-password"
                    required
                >
            </div>
        </div>

        <div class="form-actions">
            <button type="submit" class="btn btn-primary">Reset Password</button>
            <a class="btn btn-secondary" href="<?= h(url('login.php')) ?>">Back to Login</a>
        </div>
    </form>
</section>
<?php require_once __DIR__ . '/partials/footer.php'; ?>
