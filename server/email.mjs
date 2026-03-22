import { randomInt } from 'node:crypto';
import { RESEND_API_KEY, RESEND_FROM_EMAIL, RESET_CODE_TTL_MS } from './config.mjs';
import { httpError, nowIso } from './utils.mjs';
import { hashPassword } from './crypto.mjs';
import { writeAuthDb } from './db/auth.mjs';

const sendResetCodeEmail = async ({ to, restaurantName, code }) => {
    if (!RESEND_API_KEY) {
        throw httpError(500, 'Email delivery is not configured. Add RESEND_API_KEY to .env.');
    }
    if (!RESEND_FROM_EMAIL) {
        throw httpError(500, 'Email delivery is not configured. Add RESEND_FROM_EMAIL to .env.');
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: RESEND_FROM_EMAIL,
            to: [to],
            subject: `Restaurant POV reset code for ${restaurantName}`,
            text: `Your Restaurant POV reset code for ${restaurantName} is ${code}. It expires in 15 minutes.`,
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.5;">
                    <h2>Restaurant POV Access Reset</h2>
                    <p>Your reset code for <strong>${restaurantName}</strong> is:</p>
                    <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.2em;">${code}</p>
                    <p>This code expires in 15 minutes.</p>
                </div>
            `,
        }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw httpError(502, payload?.message || payload?.error || 'Unable to send the reset email.');
    }
};

const sendEmail = async ({ to, subject, text, html }) => {
    if (!RESEND_API_KEY) {
        // Email not configured — log to console in dev, silently skip.
        console.warn(`[email] Skipped (no RESEND_API_KEY). Would have sent "${subject}" to ${to}`);
        return;
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: RESEND_FROM_EMAIL, to: [to], subject, text, html }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw httpError(502, result?.message || result?.error || 'Unable to send email.');
    }
};

export const sendAccountCreationEmail = async ({ to, restaurantName, masterKey, adminPin, waiterPin }) => {
    const subject = `Welcome to Restaurant POV — Your account details for ${restaurantName}`;

    const text = [
        `Welcome to Restaurant POV! Your restaurant account has been created.`,
        ``,
        `Restaurant:  ${restaurantName}`,
        `Login email: ${to}`,
        `Master key:  ${masterKey}`,
        `Admin PIN:   ${adminPin}`,
        `Waiter PIN:  ${waiterPin}`,
        ``,
        `Keep these credentials safe. You can change them any time from Settings → Restaurant Access inside the app.`,
    ].join('\n');

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 520px; line-height: 1.6; color: #1a1a1a;">
            <div style="background: #111827; padding: 24px 32px; border-radius: 12px 12px 0 0;">
                <h1 style="color: #ffffff; margin: 0; font-size: 22px;">🍽️ Restaurant POV</h1>
                <p style="color: #9ca3af; margin: 6px 0 0;">Your account is ready</p>
            </div>
            <div style="border: 1px solid #e5e7eb; border-top: none; padding: 28px 32px; border-radius: 0 0 12px 12px;">
                <p>Hi there! Your <strong>Restaurant POV</strong> account for <strong>${restaurantName}</strong> has been created successfully. Here are your login credentials:</p>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 15px;">
                    <tr style="border-bottom: 1px solid #f3f4f6;">
                        <td style="padding: 10px 0; color: #6b7280; width: 40%;">Restaurant</td>
                        <td style="padding: 10px 0; font-weight: 600;">${restaurantName}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f3f4f6;">
                        <td style="padding: 10px 0; color: #6b7280;">Login email</td>
                        <td style="padding: 10px 0; font-weight: 600;">${to}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f3f4f6;">
                        <td style="padding: 10px 0; color: #6b7280;">Master key</td>
                        <td style="padding: 10px 0; font-weight: 600; font-family: monospace; letter-spacing: 0.05em;">${masterKey}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f3f4f6;">
                        <td style="padding: 10px 0; color: #6b7280;">Admin PIN</td>
                        <td style="padding: 10px 0; font-weight: 600; font-family: monospace; letter-spacing: 0.15em;">${adminPin}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: #6b7280;">Waiter PIN</td>
                        <td style="padding: 10px 0; font-weight: 600; font-family: monospace; letter-spacing: 0.15em;">${waiterPin}</td>
                    </tr>
                </table>
                <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 14px 16px; margin-top: 8px; font-size: 14px;">
                    ⚠️ <strong>Keep this email safe.</strong> You can change these credentials any time from <em>Settings → Restaurant Access</em> inside the app.
                </div>
            </div>
        </div>
    `;

    await sendEmail({ to, subject, text, html });
};

export const issueResetCodeForProfile = async (db, profile) => {
    const code = String(randomInt(100000, 999999));
    profile.reset_code_hash = await hashPassword(code);
    profile.reset_code_expires_at = new Date(Date.now() + RESET_CODE_TTL_MS).toISOString();
    profile.updated_at = nowIso();
    await writeAuthDb(db);
    await sendResetCodeEmail({ to: profile.email, restaurantName: profile.name, code });
};
