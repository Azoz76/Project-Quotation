"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Upload, X, FileText, Image, MapPin, Link as LinkIcon } from "lucide-react";

type FileUpload = {
  file: File;
  category: "drawing" | "permit" | "document";
  preview?: string;
};

const ALLOWED_DRAWING = [".pdf", ".dwg", ".dxf"];
const ALLOWED_PERMIT = [".pdf"];
const ALLOWED_DOCS = [".pdf", ".docx", ".jpg", ".jpeg", ".png", ".webp"];
const MAX_SIZE = 10 * 1024 * 1024;

export default function NewProjectPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [drawings, setDrawings] = useState<FileUpload[]>([]);
  const [permits, setPermits] = useState<FileUpload[]>([]);
  const [documents, setDocuments] = useState<FileUpload[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const router = useRouter();

  const drawingRef = useRef<HTMLInputElement>(null);
  const permitRef = useRef<HTMLInputElement>(null);
  const documentRef = useRef<HTMLInputElement>(null);

  function addFiles(
    files: FileList | null,
    category: "drawing" | "permit" | "document",
    setter: React.Dispatch<React.SetStateAction<FileUpload[]>>,
    allowed: string[]
  ) {
    if (!files) return;
    const newFiles: FileUpload[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!allowed.includes(ext)) continue;
      if (file.size > MAX_SIZE) continue;
      newFiles.push({ file, category });
    }
    setter((prev) => [...prev, ...newFiles]);
  }

  function removeFile(
    index: number,
    setter: React.Dispatch<React.SetStateAction<FileUpload[]>>
  ) {
    setter((prev) => prev.filter((_, i) => i !== index));
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setUploadProgress(0);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        title,
        description: description || null,
        location_address: address || null,
        location_lng: mapUrl ? 0 : null,
        location_lat: mapUrl ? 0 : null,
        status: "reviewing" as "draft",
      })
      .select("id")
      .single();

    if (error || !project) {
      setSaving(false);
      return;
    }

    if (mapUrl) {
      await supabase.from("projects").update({
        description: [description, mapUrl ? `Map: ${mapUrl}` : ""].filter(Boolean).join("\n\n"),
      }).eq("id", project.id);
    }

    const allFiles = [...drawings, ...permits, ...documents];
    const total = allFiles.length;

    for (let i = 0; i < allFiles.length; i++) {
      const { file, category } = allFiles[i];
      const path = `${user.id}/${project.id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(path, file);

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from("uploads").getPublicUrl(path);

        await supabase.from("uploads").insert({
          project_id: project.id,
          user_id: user.id,
          file_name: file.name,
          file_type: file.type || "application/octet-stream",
          file_size: file.size,
          storage_path: path,
          public_url: publicUrl,
          category,
        });
      }

      setUploadProgress(Math.round(((i + 1) / total) * 100));
    }

    // Notify the client
    await supabase.from("notifications").insert({
      user_id: user.id,
      message: `Your project "${title}" has been submitted and is under review.`,
      link: `/dashboard/projects/${project.id}`,
    });

    router.push("/dashboard/projects");
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-primary mb-6">New Project</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project Details */}
        <div className="bg-white rounded-xl p-6 border border-border space-y-5">
          <h2 className="text-lg font-semibold text-primary">Project Details</h2>

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-foreground mb-1">
              Project Title *
            </label>
            <input
              id="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 3-Bedroom House - Phase 1"
              className="w-full px-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-foreground mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe your project requirements..."
              className="w-full px-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none resize-none"
            />
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-xl p-6 border border-border space-y-5">
          <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
            <MapPin className="h-5 w-5 text-accent" />
            Location
          </h2>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-foreground mb-1">
              Project Address
            </label>
            <input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 123 Main St, Riyadh, Saudi Arabia"
              className="w-full px-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label htmlFor="mapUrl" className="block text-sm font-medium text-foreground mb-1">
              Map URL
            </label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <input
                id="mapUrl"
                type="url"
                value={mapUrl}
                onChange={(e) => setMapUrl(e.target.value)}
                placeholder="Paste Google Maps or location link"
                className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
              />
            </div>
            <p className="mt-1 text-xs text-text-muted">Share your location link from Google Maps</p>
          </div>
        </div>

        {/* Engineering Drawings */}
        <div className="bg-white rounded-xl p-6 border border-border space-y-4">
          <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent" />
            Engineering Drawings *
          </h2>
          <p className="text-sm text-text-muted">Upload your engineering drawings (PDF or DWG format, max 10MB each)</p>

          <button
            type="button"
            onClick={() => drawingRef.current?.click()}
            className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg hover:border-accent transition-colors cursor-pointer"
          >
            <Upload className="h-6 w-6 text-text-muted mb-1" />
            <span className="text-sm text-text-muted">Click to upload drawings</span>
            <span className="text-xs text-text-muted mt-0.5">PDF, DWG, DXF</span>
          </button>
          <input
            ref={drawingRef}
            type="file"
            accept=".pdf,.dwg,.dxf"
            multiple
            onChange={(e) => addFiles(e.target.files, "drawing", setDrawings, ALLOWED_DRAWING)}
            className="hidden"
          />

          {drawings.length > 0 && (
            <div className="space-y-2">
              {drawings.map((f, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5 bg-surface rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-accent" />
                    <div>
                      <p className="text-sm font-medium text-primary">{f.file.name}</p>
                      <p className="text-xs text-text-muted">{formatSize(f.file.size)}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => removeFile(i, setDrawings)} className="text-text-muted hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Building Permit */}
        <div className="bg-white rounded-xl p-6 border border-border space-y-4">
          <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent" />
            Building Permit
          </h2>
          <p className="text-sm text-text-muted">Upload your building permit document (PDF format, max 10MB)</p>

          <button
            type="button"
            onClick={() => permitRef.current?.click()}
            className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg hover:border-accent transition-colors cursor-pointer"
          >
            <Upload className="h-6 w-6 text-text-muted mb-1" />
            <span className="text-sm text-text-muted">Click to upload building permit</span>
            <span className="text-xs text-text-muted mt-0.5">PDF only</span>
          </button>
          <input
            ref={permitRef}
            type="file"
            accept=".pdf"
            multiple
            onChange={(e) => addFiles(e.target.files, "permit", setPermits, ALLOWED_PERMIT)}
            className="hidden"
          />

          {permits.length > 0 && (
            <div className="space-y-2">
              {permits.map((f, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5 bg-surface rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-accent" />
                    <div>
                      <p className="text-sm font-medium text-primary">{f.file.name}</p>
                      <p className="text-xs text-text-muted">{formatSize(f.file.size)}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => removeFile(i, setPermits)} className="text-text-muted hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Additional Documents */}
        <div className="bg-white rounded-xl p-6 border border-border space-y-4">
          <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
            <Image className="h-5 w-5 text-accent" />
            Additional Documents
          </h2>
          <p className="text-sm text-text-muted">Upload any other relevant documents or images (PDF, DOCX, JPG, PNG — max 10MB each)</p>

          <button
            type="button"
            onClick={() => documentRef.current?.click()}
            className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg hover:border-accent transition-colors cursor-pointer"
          >
            <Upload className="h-6 w-6 text-text-muted mb-1" />
            <span className="text-sm text-text-muted">Click to upload documents</span>
            <span className="text-xs text-text-muted mt-0.5">PDF, DOCX, JPG, PNG, WebP</span>
          </button>
          <input
            ref={documentRef}
            type="file"
            accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
            multiple
            onChange={(e) => addFiles(e.target.files, "document", setDocuments, ALLOWED_DOCS)}
            className="hidden"
          />

          {documents.length > 0 && (
            <div className="space-y-2">
              {documents.map((f, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5 bg-surface rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-accent" />
                    <div>
                      <p className="text-sm font-medium text-primary">{f.file.name}</p>
                      <p className="text-xs text-text-muted">{formatSize(f.file.size)}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => removeFile(i, setDocuments)} className="text-text-muted hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upload progress */}
        {saving && uploadProgress > 0 && (
          <div className="bg-white rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-primary">Uploading files...</span>
              <span className="text-sm text-accent font-medium">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-surface-alt rounded-full h-2">
              <div
                className="bg-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Summary */}
        {(drawings.length > 0 || permits.length > 0 || documents.length > 0) && (
          <div className="bg-surface-alt rounded-xl p-4 text-sm text-text-muted">
            <span className="font-medium text-primary">Files ready: </span>
            {[
              drawings.length > 0 && `${drawings.length} drawing${drawings.length > 1 ? "s" : ""}`,
              permits.length > 0 && `${permits.length} permit${permits.length > 1 ? "s" : ""}`,
              documents.length > 0 && `${documents.length} document${documents.length > 1 ? "s" : ""}`,
            ].filter(Boolean).join(", ")}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 font-medium transition-colors"
          >
            {saving ? "Submitting..." : "Submit"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 border border-border rounded-lg hover:bg-surface font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
