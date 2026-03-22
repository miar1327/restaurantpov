<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

/*
|--------------------------------------------------------------------------
| PDO Database Connection
|--------------------------------------------------------------------------
| A small reusable helper that returns one shared PDO connection.
*/

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=utf8mb4',
        DB_HOST,
        DB_NAME
    );

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        return $pdo;
    } catch (PDOException $exception) {
        error_log('Database connection failed: ' . $exception->getMessage());
        http_response_code(500);
        exit('Database connection failed. Please check your settings and try again.');
    }
}
