<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

/*
|--------------------------------------------------------------------------
| Protected Page Guard
|--------------------------------------------------------------------------
| Include this file at the top of pages that require login.
*/

if (!is_logged_in()) {
    set_flash('error', 'Please sign in to continue.');
    redirect('login.php');
}
