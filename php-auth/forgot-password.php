<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/mail_helper.php';

$email = '';
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim($_POST['email'] ?? ''));

    if (!verify_csrf_token($_POST['csrf_token'] ?? '')) {
        $errors[] = 'Your session expired. Please refresh the page and try again.';
    }

    if ($email === '') {
        $errors[] = 'Email is required.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Please enter a valid email address.';
    }

    if (!$errors) {
        $findUser = db()->prepare(
            'SELECT id, full_name, email
             FROM users
             WHERE email = :email
             LIMIT 1'
        );
        $findUser->execute(['email' => $email]);
        $user = $findUser->fetch();

        if ($user) {
            $resetCode = generate_reset_code();
            $resetCodeExpiresAt = date(
                'Y-m-d H:i:s',
                strtotime('+' . RESET_CODE_TTL_MINUTES . ' minutes')
            );

            $storeCode = db()->prepare(
                'UPDATE users
                 SET reset_code = :reset_code,
                     reset_code_expires_at = :reset_code_expires_at,
                     updated_at = NOW()
                 WHERE id = :id'
            );

            $storeCode->execute([
                'reset_code' => $resetCode,
                'reset_code_expires_at' => $resetCodeExpiresAt,
                'id' => $user['id'],
            ]);

            // Even if email sending fails, the public response stays neutral.
            send_reset_code_email($user['email'], $user['full_name'], $resetCode);
        }

        set_flash(
            'success',
            'If the email exists in our system, a reset code has been sent.'
        );
        redirect('forgot-password.php');
    }
}

$pageTitle = 'Forgot Password';
$pageDescription = 'Enter your email address and we will send a 6-digit reset code if the account exists.';
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
        </div>

        <div class="form-actions">
            <button type="submit" class="btn btn-primary">Send Reset Code</button>
            <a class="btn btn-secondary" href="<?= h(url('login.php')) ?>">Back to Login</a>
        </div>
    </form>

    <div class="text-links">
        <a href="<?= h(url('reset-password.php')) ?>">Already have the code? Reset password</a>
    </div>
</section>
<?php require_once __DIR__ . '/partials/footer.php'; ?>
