// Shared signed direct-to-Cloudinary upload, used by the
// certificate generator for the PDFs it makes in the browser.
// It is the same flow the upload components already use: ask the
// server for a signature for one folder, then post the file
// straight to Cloudinary, so a large file never goes through a
// server function body. The existing components keep their own
// copies of this flow and are unchanged.
export async function uploadFileToCloudinary({ file, fileName, folder, resourceType }) {
  const sigRes = await fetch("/api/upload/signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder }),
  });
  const sig = await sigRes.json();
  if (!sig.ok) throw new Error("UPLOAD_NOT_ALLOWED");
  const form = new FormData();
  form.append("file", file, fileName);
  form.append("api_key", sig.data.apiKey);
  form.append("timestamp", String(sig.data.timestamp));
  form.append("signature", sig.data.signature);
  form.append("folder", sig.data.folder);
  // allowed_formats was part of the signed parameters, so it must
  // be sent with the same value or Cloudinary refuses the upload.
  // max_file_size is NOT sent: it is not a Cloudinary Upload API
  // parameter, and signing + sending it broke every upload with a
  // 401 (Nov 2026).
  form.append("allowed_formats", sig.data.allowedFormats);
  const up = await fetch(`https://api.cloudinary.com/v1_1/${sig.data.cloudName}/${resourceType}/upload`, {
    method: "POST",
    body: form,
  });
  const upJson = await up.json();
  if (!up.ok || !upJson.secure_url) throw new Error("UPLOAD_FAILED");
  return upJson.secure_url;
}
