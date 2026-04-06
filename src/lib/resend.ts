import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export interface CheckInEmailData {
  workerName: string;
  workerRole: string;
  siteName: string;
  checkInTime: string;
  latitude: number;
  longitude: number;
  selfieUrl?: string;
  dealTitle?: string;
}

export async function sendCheckInEmail(toEmails: string[], data: CheckInEmailData) {
  const mapsLink = `https://maps.google.com/?q=${data.latitude},${data.longitude}`;

  await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: toEmails,
    subject: `[BuildFlow] ${data.workerName} checked in at ${data.siteName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0f172a;">Check-in Notification</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; font-weight: bold;">Staff</td><td style="padding: 8px;">${data.workerName} (${data.workerRole})</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Site</td><td style="padding: 8px;">${data.siteName}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Time</td><td style="padding: 8px;">${data.checkInTime}</td></tr>
          ${data.dealTitle ? `<tr><td style="padding: 8px; font-weight: bold;">Deal</td><td style="padding: 8px;">${data.dealTitle}</td></tr>` : ""}
          <tr><td style="padding: 8px; font-weight: bold;">Location</td><td style="padding: 8px;"><a href="${mapsLink}">View on Maps</a></td></tr>
        </table>
        ${data.selfieUrl ? `<div style="margin-top: 16px;"><img src="${data.selfieUrl}" alt="Check-in selfie" style="max-width: 300px; border-radius: 8px;" /></div>` : ""}
        <p style="color: #64748b; font-size: 12px; margin-top: 24px;">Sent by BuildFlow</p>
      </div>
    `,
  });
}

export async function sendInviteEmail({
  to,
  name,
  inviterName,
  companyName,
}: {
  to: string;
  name: string;
  inviterName: string;
  companyName: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: `You've been invited to join ${companyName} on BuildFlow`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0f172a;">You're invited!</h2>
        <p>Hi ${name},</p>
        <p><strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> on BuildFlow.</p>
        <p>Click the button below to create your account and get started:</p>
        <a href="${appUrl}/sign-up" style="display: inline-block; background: linear-gradient(to right, #7c3aed, #4f46e5); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
          Accept Invitation
        </a>
        <p style="color: #64748b; font-size: 13px;">Sign up using the email address this was sent to: <strong>${to}</strong></p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">Sent by BuildFlow</p>
      </div>
    `,
  });
}
