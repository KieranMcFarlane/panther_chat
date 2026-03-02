import { Resend } from "resend";

interface AuthEmailInput {
  email: string;
  name?: string | null;
  url: string;
}

function isValidEmailAddress(value?: string | null) {
  if (!value) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getAuthEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = isValidEmailAddress(process.env.AUTH_EMAIL_FROM)
    ? process.env.AUTH_EMAIL_FROM
    : (isValidEmailAddress(process.env.RESEND_FROM_EMAIL) ? process.env.RESEND_FROM_EMAIL : undefined);
  const fromName = process.env.AUTH_EMAIL_FROM_NAME || process.env.RESEND_FROM_NAME || "Signal Noise";
  const configured = Boolean(apiKey && fromEmail);

  return {
    apiKey,
    fromEmail,
    fromName,
    configured,
  };
}

async function sendAuthEmail({
  input,
  subject,
  heading,
  actionLabel,
}: {
  input: AuthEmailInput;
  subject: string;
  heading: string;
  actionLabel: string;
}) {
  const config = getAuthEmailConfig();

  if (!config.configured) {
    const message = "Better Auth email delivery is not configured. Set RESEND_API_KEY and AUTH_EMAIL_FROM (or RESEND_FROM_EMAIL).";

    if (process.env.NODE_ENV === "production") {
      throw new Error(message);
    }

    console.warn(`${message} Requested email for ${input.email}: ${input.url}`);
    return;
  }

  const resend = new Resend(config.apiKey);
  const recipientName = input.name || input.email;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h1 style="margin-bottom: 16px;">${heading}</h1>
      <p style="margin-bottom: 12px;">Hi ${recipientName},</p>
      <p style="margin-bottom: 24px;">Use the button below to continue.</p>
      <p style="margin-bottom: 24px;">
        <a href="${input.url}" style="background: #111827; color: #ffffff; padding: 12px 18px; border-radius: 8px; text-decoration: none; display: inline-block;">
          ${actionLabel}
        </a>
      </p>
      <p style="font-size: 12px; color: #6b7280;">If the button does not work, copy and paste this URL into your browser:</p>
      <p style="font-size: 12px; color: #6b7280; word-break: break-all;">${input.url}</p>
    </div>
  `;

  await resend.emails.send({
    from: `${config.fromName} <${config.fromEmail}>`,
    to: [input.email],
    subject,
    html,
    text: `${heading}\n\n${input.url}`,
  });
}

export async function sendAuthVerificationEmail(input: AuthEmailInput) {
  await sendAuthEmail({
    input,
    subject: "Verify your Signal Noise account",
    heading: "Verify your email",
    actionLabel: "Verify email",
  });
}

export async function sendAuthResetPasswordEmail(input: AuthEmailInput) {
  await sendAuthEmail({
    input,
    subject: "Reset your Signal Noise password",
    heading: "Reset your password",
    actionLabel: "Reset password",
  });
}
