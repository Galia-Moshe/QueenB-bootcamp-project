import nodemailer, { type Transporter } from "nodemailer";

type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type SendEmailResult =
  | {
      ok: true;
      messageId?: string;
    }
  | {
      ok: false;
      error: string;
      skipped?: boolean;
    };

let transporter: Transporter | null = null;
let transporterSignature = "";

function getSmtpConfig() {
  const user = process.env.SMTP_USER?.trim() || "";
  const password = process.env.SMTP_PASSWORD?.replace(/\s+/g, "") || "";
  const from = process.env.SMTP_FROM_EMAIL?.trim() || user;

  return { user, password, from };
}

function getTransporter() {
  const { user, password } = getSmtpConfig();

  if (!user || !password) {
    return null;
  }

  const signature = `${user}:${password}`;

  if (!transporter || transporterSignature !== signature) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user,
        pass: password,
      },
    });
    transporterSignature = signature;
  }

  return transporter;
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown email error";
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const smtpTransporter = getTransporter();
  const { from } = getSmtpConfig();

  if (!smtpTransporter || !from) {
    const error = "SMTP_USER or SMTP_PASSWORD is not configured";
    console.warn(`[email] ${error}; skipped email to ${options.to}`);
    return { ok: false, error, skipped: true };
  }

  try {
    const info = await smtpTransporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    return { ok: true, messageId: info.messageId };
  } catch (error) {
    const message = formatError(error);
    console.error(`[email] Failed to send email to ${options.to}: ${message}`);
    return { ok: false, error: message };
  }
}
