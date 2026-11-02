import "server-only";

/**
 * Sends transactional email (verification links). Uses SMTP when SMTP_URL is
 * set (e.g. smtps://user:pass@smtp.example.com:465); otherwise prints the
 * message to the server log so self-hosters can still copy the link.
 */
export async function sendEmail(msg: { to: string; subject: string; text: string }) {
  const url = process.env.SMTP_URL;
  if (!url) {
    console.log(`\n[email] SMTP_URL is not set, so this email was not sent.\n  To: ${msg.to}\n  Subject: ${msg.subject}\n\n${msg.text}\n`);
    return;
  }
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport(url);
  await transport.sendMail({ from: process.env.EMAIL_FROM || "Digital Twin <no-reply@localhost>", ...msg });
}
