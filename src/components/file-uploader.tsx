"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Upload } from "lucide-react";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DOC_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
const ALL_TYPES = [...IMAGE_TYPES, ...DOC_TYPES];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_DOC_SIZE = 10 * 1024 * 1024;

export function FileUploader({
  projectId,
  userId,
  category,
}: {
  projectId: string;
  userId: string;
  category: "image" | "document" | "drawing";
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");

    if (!ALL_TYPES.includes(file.type)) {
      setError("File type not allowed. Use JPG, PNG, WebP, PDF, or DOCX.");
      return;
    }

    const maxSize = IMAGE_TYPES.includes(file.type) ? MAX_IMAGE_SIZE : MAX_DOC_SIZE;
    if (file.size > maxSize) {
      setError(`File too large. Max ${maxSize / 1024 / 1024}MB.`);
      return;
    }

    setUploading(true);
    setProgress(30);

    const supabase = createClient();
    const path = `${userId}/${projectId}/${Date.now()}-${file.name}`;

    setProgress(50);
    const { error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(path, file);

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    setProgress(80);
    const { data: { publicUrl } } = supabase.storage
      .from("uploads")
      .getPublicUrl(path);

    await supabase.from("uploads").insert({
      project_id: projectId,
      user_id: userId,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path: path,
      public_url: publicUrl,
      category,
    });

    setProgress(100);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    window.location.reload();
  }

  return (
    <div>
      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-accent transition-colors">
        <Upload className="h-8 w-8 text-text-muted mb-2" />
        <span className="text-sm text-text-muted">
          {uploading ? `Uploading... ${progress}%` : "Click to upload or drag and drop"}
        </span>
        <span className="text-xs text-text-muted mt-1">
          Images (5MB) &middot; Documents (10MB)
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={ALL_TYPES.join(",")}
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
        />
      </label>

      {uploading && (
        <div className="mt-3 w-full bg-surface-alt rounded-full h-2">
          <div
            className="bg-accent h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
