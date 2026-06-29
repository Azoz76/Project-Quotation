import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { formatDate, formatCurrency } from "@/lib/utils";
import { FileUploader } from "@/components/file-uploader";
import { QuotationSection } from "@/components/quotation-section";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const { data: uploads } = await supabase
    .from("uploads")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  const { data: quotation } = await supabase
    .from("quotations")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">{project.title}</h1>
          {project.description && (
            <p className="mt-1 text-text-muted">{project.description}</p>
          )}
          <p className="mt-1 text-sm text-text-muted">Created {formatDate(project.created_at)}</p>
        </div>
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-accent/10 text-accent">
          {project.status.replace("_", " ")}
        </span>
      </div>

      {project.location_address && (
        <div className="bg-white rounded-xl p-4 border border-border mb-6">
          <p className="text-sm text-text-muted">Location</p>
          <p className="font-medium text-primary">{project.location_address}</p>
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-white rounded-xl p-6 border border-border">
          <h2 className="text-lg font-semibold text-primary mb-4">Upload Engineering Drawings</h2>
          <FileUploader projectId={project.id} userId={user.id} category="drawing" />

          {uploads && uploads.length > 0 && (
            <div className="mt-6 space-y-2">
              <h3 className="text-sm font-medium text-foreground">Uploaded Files</h3>
              {uploads.map((file) => (
                <div key={file.id} className="flex items-center justify-between px-4 py-2 bg-surface rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-primary">{file.file_name}</p>
                    <p className="text-xs text-text-muted">
                      {(file.file_size / 1024 / 1024).toFixed(2)} MB &middot; {formatDate(file.created_at)}
                    </p>
                  </div>
                  <a
                    href={file.public_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent hover:text-accent-hover"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        <QuotationSection
          projectId={project.id}
          userId={user.id}
          existingQuotation={quotation}
          hasDrawings={(uploads ?? []).some((u) => u.category === "drawing")}
        />
      </div>
    </div>
  );
}
