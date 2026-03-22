<?php
declare(strict_types=1);

require_once __DIR__ . '/session_check.php';
require_once __DIR__ . '/db.php';

$user = current_user();

$loadUser = db()->prepare(
    'SELECT full_name, email, is_verified, created_at, updated_at
     FROM users
     WHERE id = :id
     LIMIT 1'
);
$loadUser->execute(['id' => $user['id']]);
$account = $loadUser->fetch();

if (!$account) {
    logout_user();
    set_flash('error', 'Your session is no longer valid. Please log in again.');
    redirect('login.php');
}

$pageTitle = 'Dashboard';
$pageDescription = 'This page is protected by session_check.php and only visible after login.';
require_once __DIR__ . '/partials/header.php';
?>
<section class="card">
    <div class="card-header">
        <h1 class="card-title">Welcome, <?= h($account['full_name']) ?></h1>
        <p class="card-subtitle"><?= h($pageDescription) ?></p>
    </div>

    <div class="dashboard-grid">
        <div class="card">
            <div class="card-header">
                <h2 class="card-title">Account Overview</h2>
                <p class="card-subtitle">Your verified account details from MySQL.</p>
            </div>

            <div class="info-list">
                <div class="info-row">
                    <span class="info-label">Full Name</span>
                    <span class="info-value"><?= h($account['full_name']) ?></span>
                </div>

                <div class="info-row">
                    <span class="info-label">Email Address</span>
                    <span class="info-value"><?= h($account['email']) ?></span>
                </div>

                <div class="info-row">
                    <span class="info-label">Verification Status</span>
                    <span class="info-value">
                        <span class="status-chip">Verified</span>
                    </span>
                </div>

                <div class="info-row">
                    <span class="info-label">Created At</span>
                    <span class="info-value mono"><?= h((string) $account['created_at']) ?></span>
                </div>

                <div class="info-row">
                    <span class="info-label">Updated At</span>
                    <span class="info-value mono"><?= h((string) $account['updated_at']) ?></span>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <h2 class="card-title">Quick Actions</h2>
                <p class="card-subtitle">Common navigation for this simple starter module.</p>
            </div>

            <div class="form-actions">
                <a class="btn btn-primary" href="<?= h(url('logout.php')) ?>">Logout</a>
                <a class="btn btn-secondary" href="<?= h(url('forgot-password.php')) ?>">Forgot Password Page</a>
            </div>

            <p class="helper-text">
                You can now expand this protected area into a real restaurant dashboard,
                booking system, or admin panel.
            </p>
        </div>
    </div>
</section>
<?php require_once __DIR__ . '/partials/footer.php'; ?>
