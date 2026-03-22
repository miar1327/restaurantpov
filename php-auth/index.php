<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

// Send users to the correct starting page.
if (is_logged_in()) {
    redirect('dashboard.php');
}

redirect('login.php');
