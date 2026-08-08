import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const from = process.env.RESEND_FROM_EMAIL ?? "Bancroft Brew Bowl <hello@bancroftbrewbowl.ca>";

// No RESEND_API_KEY set (local dev by default) — print the link instead of
// sending, so local dev needs zero email-provider setup. Production sets a
// real key.
export async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    console.log(`[email] (no RESEND_API_KEY set) ${subject} -> ${to}`);
    return;
  }
  await resend.emails.send({ from, to, subject, html });
}
