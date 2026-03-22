<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

if (is_logged_in()) {
    redirect('dashboard.php');
}

$email = strtolower(trim($_GET['email'] ?? ''));
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim($_POST['email'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');

    if (!verify_csrf_token($_POST['csrf_token'] ?? '')) {
        $errors[] = 'Your session expired. Please refresh the page and try again.';
    }

    if ($email === '') {
        $errors[] = 'Email is required.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Please enter a valid email address.';
    }

    if ($password === '') {
        $errors[] = 'Password is required.';
    }

    if (!$errors) {
        $findUser = db()->prepare(
            'SELECT id, full_name, email, password_hash, is_verified
             FROM users
             WHERE email = :email
             LIMIT 1'
        );
        $findUser->execute(['email' => $email]);
        $user = $findUser->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            $errors[] = 'Invalid email or password.';
        } elseif ((int) $user['is_verified'] !== 1) {
            $errors[] = 'Your account is not verified yet. Please check your email first.';
        } else {
            login_user($user);
            redirect('dashboard.php');
        }
    }
}

$pageTitle = 'Login';
$pageDescription = 'Sign in with your verified email address and password.';
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
                <label for="password">Password</label>
                <input
                    type="password"
                    id="password"
                    name="password"
                    autocomplete="current-password"
                    required
                >
            </div>
        </div>

        <div class="form-actions">
            <button type="submit" class="btn btn-primary">Login</button>
            <a class="btn btn-secondary" href="<?= h(url('register.php')) ?>">Create Account</a>
        </div>
    </form>

    <div class="text-links">
        <a href="<?= h(url('forgot-password.php')) ?>">Forgot your password?</a>
        <a href="<?= h(url('reset-password.php')) ?>">Already have a reset code?</a>
    </div>
</section>
<?php require_once __DIR__ . '/partials/footer.php'; ?>
