<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';

$pageTitle = $pageTitle ?? APP_NAME;
$pageDescription = $pageDescription ?? 'Production-ready PHP authentication module';
$flashMessages = get_flash_messages();
$loggedInUser = current_user();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= h($pageTitle) ?> | <?= h(APP_NAME) ?></title>
    <link rel="stylesheet" href="<?= h(url('assets/auth.css')) ?>">
</head>
<body>
    <div class="site-shell">
        <header class="site-header">
            <div class="brand-block">
                <a class="brand-title" href="<?= h(url('index.php')) ?>"><?= h(APP_NAME) ?></a>
                <p class="brand-subtitle">Secure account access for your restaurant website</p>
            </div>

            <nav class="site-nav">
                <?php if ($loggedInUser): ?>
                    <a class="nav-link" href="<?= h(url('dashboard.php')) ?>">Dashboard</a>
                    <a class="nav-link" href="<?= h(url('logout.php')) ?>">Logout</a>
                <?php else: ?>
                    <a class="nav-link" href="<?= h(url('login.php')) ?>">Login</a>
                    <a class="nav-link" href="<?= h(url('register.php')) ?>">Register</a>
                    <a class="nav-link" href="<?= h(url('forgot-password.php')) ?>">Forgot Password</a>
                <?php endif; ?>
            </nav>
        </header>

        <main class="page-wrapper">
            <?php if ($flashMessages): ?>
                <div class="flash-stack">
                    <?php foreach ($flashMessages as $flash): ?>
                        <div class="alert alert-<?= h($flash['type']) ?>">
                            <?= h($flash['message']) ?>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
