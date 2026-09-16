import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter;

export function emailConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_FROM);
}

function getTransporter() {
  if (!emailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      requireTLS: env.SMTP_REQUIRE_TLS,
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: env.SMTP_TLS_REJECT_UNAUTHORIZED },
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      // Prevent a future template or integration from using local files or
      // fetching arbitrary URLs through Nodemailer's content resolver.
      disableFileAccess: true,
      disableUrlAccess: true,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
    });
  }
  return transporter;
}

export async function verifyEmailService() {
  const transport = getTransporter();
  if (!transport) return { configured: false, verified: false };
  await transport.verify();
  return { configured: true, verified: true };
}

export async function sendEmail({ to, subject, text, html }) {
  const transport = getTransporter();
  if (!transport) throw new Error('SMTP is not configured');
  return transport.sendMail({ from: env.SMTP_FROM, to, subject, text, html });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
}

export async function sendOtpEmail({ to, name, otp }) {
  const safeName = escapeHtml(name || 'there');
  const safeOtp = escapeHtml(otp);
  return sendEmail({
    to,
    subject: 'Your SecureAsset verification code',
    text: `Hello ${name || 'there'}, your SecureAsset verification code is ${otp}. It expires in 10 minutes.`,
    html: `<p>Hello ${safeName},</p><p>Your SecureAsset verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:5px">${safeOtp}</p><p>This code expires in 10 minutes. Do not share it with anyone.</p>`,
  });
}

export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const safeName = escapeHtml(name || 'there');
  const safeUrl = escapeHtml(resetUrl);
  return sendEmail({
    to,
    subject: 'Reset your SecureAsset password',
    text: `Hello ${name || 'there'}, reset your SecureAsset password using this link: ${resetUrl}. The link expires in 30 minutes.`,
    html: `<p>Hello ${safeName},</p><p>Use the secure link below to reset your password. It expires in 30 minutes.</p><p><a href="${safeUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
}
