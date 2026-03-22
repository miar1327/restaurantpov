<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/db.php';

/*
|--------------------------------------------------------------------------
| Database Setup Page
|--------------------------------------------------------------------------
| This page creates the users table from auth_schema.sql using the current
| values in config.php. Run it once after you update the real Hostinger
| MySQL credentials, then delete this file from production.
*/

$pageTitle = 'Setup Database';
$pageDescription = 'Create the users table for the PHP authentication module.';

$schemaFile = __DIR__ . '/auth_schema.sql';
$lockFile = __DIR__ . '/.setup.lock';
$errors = [];
$successMessage = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf_token($_POST['csrf_token'] ?? '')) {
        $errors[] = 'Your session expired. Please refresh the page and try again.';
    } elseif (file_exists($lockFile)) {
        $errors[] = 'Database setup has already been completed. Delete .setup.lock only if you really need to rerun setup.';
    } elseif (!file_exists($schemaFile)) {
        $errors[] = 'The schema file auth_schema.sql could not be found.';
    } else {
        try {
            $schema = file_get_contents($schemaFile);

            if ($schema === false || trim($schema) === '') {
                $errors[] = 'The schema file is empty.';
            } else {
                db()->exec($schema);
                file_put_contents(
                    $lockFile,
                    "Database setup completed at " . date('c') . PHP_EOL
                );
                $successMessage = 'Database setup completed successfully. The users table is ready.';
            }
        } catch (Throwable $exception) {
            error_log('Database setup failed: ' . $exception->getMessage());
            $errors[] = 'Database setup failed. Please check config.php and your Hostinger MySQL credentials.';
        }
    }
}

require_once __DIR__ . '/partials/header.php';
?>
<section class="card">
    <div class="card-header">
        <h1 class="card-title"><?= h($pageTitle) ?></h1>
        <p class="card-subtitle"><?= h($pageDescription) ?></p>
    </div>

    <?php if ($successMessage !== ''): ?>
        <div class="alert alert-success"><?= h($successMessage) ?></div>
    <?php endif; ?>

    <?php if ($errors): ?>
        <div class="alert alert-error">
            <ul class="error-list">
                <?php foreach ($errors as $error): ?>
                    <li><?= h($error) ?></li>
                <?php endforeach; ?>
            </ul>
        </div>
    <?php endif; ?>

    <?php if (file_exists($lockFile)): ?>
        <div class="alert alert-warning">
            Setup is locked because this installer has already been run once.
            Delete <span class="mono">.setup.lock</span> only if you intentionally want to run it again.
        </div>
    <?php endif; ?>

    <div class="card">
        <div class="card-header">
            <h2 class="card-title">Current Connection Settings</h2>
            <p class="card-subtitle">These values come from config.php and are what the installer will use.</p>
        </div>

        <div class="info-list">
            <div class="info-row">
                <span class="info-label">BASE_URL</span>
                <span class="info-value mono"><?= h(BASE_URL) ?></span>
            </div>
            <div class="info-row">
                <span class="info-label">DB_HOST</span>
                <span class="info-value mono"><?= h(DB_HOST) ?></span>
            </div>
            <div class="info-row">
                <span class="info-label">DB_NAME</span>
                <span class="info-value mono"><?= h(DB_NAME) ?></span>
            </div>
            <div class="info-row">
                <span class="info-label">DB_USER</span>
                <span class="info-value mono"><?= h(DB_USER) ?></span>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-header">
            <h2 class="card-title">Important Notes</h2>
            <p class="card-subtitle">A few deployment details before you run setup.</p>
        </div>

        <ul class="error-list">
            <li>Your Gmail address `miar.md78692@gmail.com` is fine as a test account that receives verification and reset emails.</li>
            <li>For Hostinger SMTP, the sender should still be a domain mailbox like `noreply@yourdomain.com`.</li>
            <li>Run this page only after replacing the temporary database placeholders in `config.php` with your real Hostinger MySQL values.</li>
            <li>Delete `setup-database.php` from production after the database is created.</li>
        </ul>
    </div>

    <?php if (!file_exists($lockFile)): ?>
        <form method="post" novalidate>
            <input type="hidden" name="csrf_token" value="<?= h(get_csrf_token()) ?>">
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Run Database Setup</button>
                <a class="btn btn-secondary" href="<?= h(url('login.php')) ?>">Go to Login</a>
            </div>
        </form>
    <?php endif; ?>
</section>
<?php require_once __DIR__ . '/partials/footer.php'; ?>
