<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    require_once __DIR__ . '/vendor/autoload.php';
}

use PHPMailer\PHPMailer\PHPMailer;

/*
|--------------------------------------------------------------------------
| Email Helper Functions
|--------------------------------------------------------------------------
| PHPMailer is used so this works well on Hostinger shared hosting.
*/

function create_mailer(): PHPMailer
{
    if (!class_exists(PHPMailer::class)) {
        throw new RuntimeException('PHPMailer is not installed. Run composer install before sending emails.');
    }

    $mailer = new PHPMailer(true);
    $mailer->isSMTP();
    $mailer->Host = SMTP_HOST;
    $mailer->SMTPAuth = true;
    $mailer->Username = SMTP_USERNAME;
    $mailer->Password = SMTP_PASSWORD;
    $mailer->Port = (int) SMTP_PORT;
    $mailer->CharSet = 'UTF-8';
    $mailer->setFrom(SMTP_FROM_EMAIL, SMTP_FROM_NAME);
    $mailer->isHTML(true);

    // Port 465 usually uses SSL, while 587 usually uses TLS.
    $mailer->SMTPSecure = ((int) SMTP_PORT === 465)
        ? PHPMailer::ENCRYPTION_SMTPS
        : PHPMailer::ENCRYPTION_STARTTLS;

    return $mailer;
}

function send_email_message(
    string $toEmail,
    string $toName,
    string $subject,
    string $htmlBody,
    string $plainTextBody
): bool {
    try {
        $mailer = create_mailer();
        $mailer->addAddress($toEmail, $toName);
        $mailer->Subject = $subject;
        $mailer->Body = $htmlBody;
        $mailer->AltBody = $plainTextBody;
        return $mailer->send();
    } catch (Throwable $exception) {
        error_log('Email send failed: ' . $exception->getMessage());
        return false;
    }
}

function send_verification_email(string $email, string $fullName, string $token): bool
{
    $verificationLink = url('verify-email.php?token=' . urlencode($token));
    $subject = APP_NAME . ' - Verify your email address';

    $htmlBody = '
        <h2>Verify your email</h2>
        <p>Hello ' . h($fullName) . ',</p>
        <p>Thank you for registering. Please click the button below to verify your email address.</p>
        <p>
            <a href="' . h($verificationLink) . '" style="display:inline-block;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;">
                Verify Email
            </a>
        </p>
        <p>If the button does not work, copy and paste this link into your browser:</p>
        <p>' . h($verificationLink) . '</p>
        <p>This link will expire in ' . VERIFICATION_TOKEN_TTL_HOURS . ' hours.</p>
    ';

    $plainTextBody =
        "Hello {$fullName},\n\n" .
        "Thank you for registering. Please verify your email address by opening this link:\n" .
        "{$verificationLink}\n\n" .
        'This link will expire in ' . VERIFICATION_TOKEN_TTL_HOURS . " hours.\n";

    return send_email_message($email, $fullName, $subject, $htmlBody, $plainTextBody);
}

function send_reset_code_email(string $email, string $fullName, string $resetCode): bool
{
    $subject = APP_NAME . ' - Password reset code';

    $htmlBody = '
        <h2>Password reset request</h2>
        <p>Hello ' . h($fullName) . ',</p>
        <p>Use the 6-digit code below to reset your password:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px;">' . h($resetCode) . '</p>
        <p>This code expires in ' . RESET_CODE_TTL_MINUTES . ' minutes.</p>
        <p>If you did not request a password reset, you can ignore this email.</p>
    ';

    $plainTextBody =
        "Hello {$fullName},\n\n" .
        "Use this 6-digit code to reset your password: {$resetCode}\n\n" .
        'This code expires in ' . RESET_CODE_TTL_MINUTES . " minutes.\n";

    return send_email_message($email, $fullName, $subject, $htmlBody, $plainTextBody);
}
