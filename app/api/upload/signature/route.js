import { NextResponse } from "next/server";
import { getSession, requireAdmin } from "@/lib/auth";
import { cloudinarySignature } from "@/lib/upload";
import { ok, fail } from "@/lib/json";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request) {
  const session = await getSession();
  if (!session) return fail("NOT_SIGNED_IN", 401);
  // Risks review: rate limiting, 30/min/IP, checked after auth so a
  // signed-out caller gets 401, not 429. fail() cannot set headers,
  // so the 429 is built here with the Retry-After header.
  const limit = checkRateLimit(request, "upload-signature", 30, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }
  // m3 (minors): a malformed or empty JSON body used to throw here
  // and return a Next 500. An empty object fails the folder check
  // below with a 400 instead.
  const body = await request.json().catch(() => ({}));
  const folder = String(body.folder || "");
  const allowed = [
    "vector-flow/posters",
    "vector-flow/qr",
    "vector-flow/screenshots",
    "vector-flow/certificates",
    "vector-flow/cert-templates",
    "vector-flow/team",
  ];
  if (!allowed.includes(folder)) return fail("INVALID_FILE", 400);
  // Certificates and team photos are admin-only folders, like posters
  // and QR images. Payment screenshots stay open to any signed-in
  // student, because students must be able to upload their own.
  // M5: the admin check re-reads the role from the DB (requireAdmin),
  // instead of trusting the role baked into the JWT at sign-in, so
  // a demoted admin loses upload power at once.
  if (folder !== "vector-flow/screenshots") {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
  }
  try {
    return ok(cloudinarySignature(folder));
  } catch {
    return fail("INVALID_FILE", 500);
  }
}
