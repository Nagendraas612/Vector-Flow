import crypto from "crypto";

// m3: the signature covers what is being uploaded, not just where
// it goes: the allowed formats are tied to the folder, so a WebP
// certificate template is refused by Cloudinary at upload time
// instead of failing later. The signature string holds the signed
// parameters sorted alphabetically, as Cloudinary requires (SHA-1
// over folder + timestamp is Cloudinary's own scheme, not a flaw
// -- the extra parameter just joins that string). Note, from
// Cloudinary's own signature docs: resource_type is NEVER part of
// the string to sign -- it lives in the upload URL path
// (image/upload vs raw/upload), which the components already
// choose per folder -- so it is returned here for the caller to
// use, but not hashed. The signed parameter allowed_formats must
// be sent in the upload form with the same value, or Cloudinary
// refuses the upload.
// Upload fix (Nov 2026): max_file_size used to be signed and sent
// here too, and that broke EVERY upload with a Cloudinary 401.
// max_file_size is not a Cloudinary Upload API parameter (verified
// against the Upload API Reference: zero matches, while
// allowed_formats is documented there), so Cloudinary rebuilds
// the signature from the parameters it recognises and our hash
// never matched. Never sign or send it again. Size limits live
// only in the components' client-side checks (5 MB images, 10 MB
// certificate PDFs); a Cloudinary-side size cap belongs in an
// upload preset, not in the signature.
const PRESETS = {
  "vector-flow/certificates": {
    resourceType: "raw",
    allowedFormats: "pdf",
  },
  // m12 (minors): certificate templates are JPG/PNG only, because
  // pdf-lib can embed nothing else (lib/certPdf.js embeds jpg or
  // png). The shared default below still allows webp/gif for
  // posters, QR codes and team photos; only this folder is
  // restricted, so a WebP template is refused by Cloudinary at
  // upload time instead of failing later at the template route.
  "vector-flow/cert-templates": {
    resourceType: "image",
    allowedFormats: "jpg,jpeg,png",
  },
};

function presetFor(folder) {
  return (
    PRESETS[folder] || {
      resourceType: "image",
      allowedFormats: "jpg,jpeg,png,webp,gif",
    }
  );
}

// m6 (minors): the only host the CSP lets the browser load images
// from is res.cloudinary.com (next.config.mjs img-src / frame-src).
// A template or certificate URL on any other host would fail to
// render and its fetch would be CSP-blocked, so refuse it at save
// time with a clear error instead of storing a URL that can never
// be shown. Relative URLs are never stored (both callers already
// require an http(s) URL), so the app's own origin needs no
// exception here.
export function isCloudinaryUrl(value) {
  try {
    return new URL(String(value || "")).hostname.toLowerCase() === "res.cloudinary.com";
  } catch {
    return false;
  }
}

export function cloudinarySignature(folder) {
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!secret) throw new Error("CLOUDINARY_API_SECRET is not set");
  const timestamp = Math.floor(Date.now() / 1000);
  const preset = presetFor(folder);
  const toSign =
    `allowed_formats=${preset.allowedFormats}&folder=${folder}` +
    `&timestamp=${timestamp}${secret}`;
  const signature = crypto.createHash("sha1").update(toSign).digest("hex");
  return {
    timestamp,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    folder,
    resourceType: preset.resourceType,
    allowedFormats: preset.allowedFormats,
  };
}
