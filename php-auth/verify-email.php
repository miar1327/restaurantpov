<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

$token = trim($_GET['token'] ?? '');
$messageType = 'error';
$message = 'Invalid verification link.';

if ($token !== '') {
    $findUser = db()->prepare(
        'SELECT id, verification_expires_at
         FROM users
         WHERE verification_token = :verification_token
         LIMIT 1'
    );
    $findUser->execute(['verification_token' => $token]);
    $user = $findUser->fetch();

    if (!$user) {
        $message = 'This verification link is invalid or has already been used.';
    } elseif (
        empty($user['verification_expires_at']) ||
        strtotime($user['verification_expires_at']) < time()
    ) {
        $message = 'This verification link has expired. Please register again or request a fresh verification flow.';
    } else {
        $verifyUser = db()->prepare(
            'UPDATE users
             SET is_verified = 1,
                 verification_token = NULL,
                 verification_expires_at = NULL,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $verifyUser->execute(['id' => $user['id']]);

        $messageType = 'success';
        $message = 'Your email has been verified successfully. You can now log in.';
    }
}

$pageTitle = 'Verify Email';
$pageDescription = 'Email verification result';
require_once __DIR__ . '/partials/header.php';
?>
<section class="card">
    <div class="card-header">
        <h1 class="card-title"><?= h($pageTitle) ?></h1>
        <p class="card-subtitle">This page checks your email verification link.</p>
    </div>

    <div class="alert alert-<?= h($messageType) ?>">
        <?= h($message) ?>
    </div>

    <div class="form-actions">
        <a class="btn btn-primary" href="<?= h(url('login.php')) ?>">Go to Login</a>
        <a class="btn btn-secondary" href="<?= h(url('register.php')) ?>">Create New Account</a>
    </div>
</section>
<?php require_once __DIR__ . '/partials/footer.php'; ?>
