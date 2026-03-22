<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

logout_user();
start_secure_session();
set_flash('success', 'You have been logged out successfully.');
redirect('login.php');
