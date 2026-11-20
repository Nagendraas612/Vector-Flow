// Standalone Mail section: admin-only, not tied to any event or
// slug. The admin supplies To, Subject, and Body. One QUEUED
// MailLog row (type STANDALONE) is written per recipient, and the
// mail-queue worker sends them 20 at a time, oldest first, so a
// long list never has to finish inside one request and cannot hit
// the Vercel function timeout. One mail is sent per recipient, so
// no recipient sees the others. This route never sends mail
// itself and never touches the announcement, registration, payment,
// reminder, or certificate mails or their audiences.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ok, fail } from "@/lib/json";
import { checkRateLimit } from "@/lib/rateLimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 200;
const MAX_SUBJECT = 200;
const MAX_BODY = 20000;

export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  // Risks review: rate limiting, 5/min/IP, checked after the admin
  // check so a non-admin gets the auth error, not 429. fail() cannot
  // set headers, so the 429 is built here with the Retry-After header.
  const limit = checkRateLimit(request, "admin-mail", 5, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return fail("INVALID_BODY", 400);
  }

  const rawTo = Array.isArray(payload.to) ? payload.to : [];
  const recipients = [
    ...new Set(
      rawTo
        .map((v) => String(v ?? "").trim().toLowerCase())
        .filter((v) => v !== "" && EMAIL_RE.test(v))
    ),
  ];
  const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";

  if (recipients.length === 0) return fail("NO_RECIPIENTS", 400);
  if (recipients.length > MAX_RECIPIENTS) return fail("TOO_MANY_RECIPIENTS", 400);
  if (!subject) return fail("SUBJECT_REQUIRED", 400);
  if (subject.length > MAX_SUBJECT) return fail("SUBJECT_TOO_LONG", 400);
  if (!body) return fail("BODY_REQUIRED", 400);
  if (body.length > MAX_BODY) return fail("BODY_TOO_LONG", 400);

  // Risks review: queue, do not send. Sending up to 200 mails one
  // after another inside this POST risked the Vercel function
  // timeout, so each recipient gets one QUEUED row (subject and
  // body stored) and the cron worker sends them in batches of 20.
  // A row that fails to save is reported back; the rest still queue.
  let queued = 0;
  const failedEmails = [];
  for (const toEmail of recipients) {
    try {
      await prisma.mailLog.create({
        data: {
          eventId: null,
          toEmail,
          type: "STANDALONE",
          subject,
          body,
          status: "QUEUED",
        },
      });
      queued += 1;
    } catch {
      failedEmails.push(toEmail);
    }
  }

  return ok({
    queued,
    failed: recipients.length - queued,
    total: recipients.length,
    failedEmails,
  });
}
