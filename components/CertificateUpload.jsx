"use client";

import { useState } from "react";

const MAX_BYTES = 10 * 1024 * 1024;

// PDF upload for certificates, Sprint 4. The file goes straight
// from the browser to Cloudinary with a signed upload, so a large
// PDF never goes through a server function body. The server only
// receives the resulting file address afterwards. Only PDF files
// up to 10 MB are accepted, checked here and again on the server.
export default function CertificateUpload({ onUploaded, label }) {
  const [message, setMessage] = useState("");
  // M17: the input is disabled while an upload runs, and its value
  // is reset after handling, so picking the same file again after a
  // failed upload fires onChange again instead of doing nothing.
  const [uploading, setUploading] = useState(false);
  async function onChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setMessage("Please choose a PDF file.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      setMessage("File is too large. Maximum is 10 MB.");
      e.target.value = "";
      return;
    }
    setMessage("Uploading...");
    setUploading(true);
    try {
      const sigRes = await fetch("/api/upload/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: "vector-flow/certificates" }),
      });
      const sig = await sigRes.json();
      if (!sig.ok) {
        setMessage("Upload is not allowed. Please sign in again as an admin.");
        return;
      }
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sig.data.apiKey);
      form.append("timestamp", String(sig.data.timestamp));
      form.append("signature", sig.data.signature);
      form.append("folder", sig.data.folder);
      // m3: allowed_formats was part of the signed parameters, so it
      // must be sent with the same value or Cloudinary refuses
      // the upload. It caps the file to the type the server
      // allowed for this folder. max_file_size is NOT sent: it is
      // not a Cloudinary Upload API parameter, and signing +
      // sending it broke every upload with a 401 (Nov 2026). Size
      // is enforced by the MAX_BYTES check above.
      form.append("allowed_formats", sig.data.allowedFormats);
      const up = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.data.cloudName}/raw/upload`,
        { method: "POST", body: form }
      );
      const upJson = await up.json();
      if (!up.ok || !upJson.secure_url) {
        setMessage("Upload failed. Please try again.");
        return;
      }
      setMessage("Uploaded.");
      onUploaded(upJson.secure_url, file.name);
    } catch {
      setMessage("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }
  return (
    <div>
      <label>
        {label || "Upload PDF certificate"}
        <input type="file" accept="application/pdf" onChange={onChange} disabled={uploading} />
      </label>
      {message && <p>{uploading && <span className="btn-spinner btn-spinner--dark" aria-hidden="true" />} {message}</p>}
    </div>
  );
}
