import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ImagePart = { type: "image_url"; image_url: { url: string } };
type TextPart = { type: "text"; text: string };
type ContentPart = TextPart | ImagePart;

const IMAGE_TYPES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
]);

const OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions";
const HEADERS_BASE = {
  "Content-Type": "application/json",
  "HTTP-Referer": "https://project-quotation.vercel.app",
  "X-Title": "Project Quotation AI",
};

// Vision-capable free models (tried in order)
const VISION_MODELS = [
  "google/gemma-4-31b-it:free",
  "meta-llama/llama-3.2-11b-vision-instruct:free",
  "google/gemma-3-12b-it:free",
];

// Absolute last-resort text models if the live fetch fails
const EMERGENCY_TEXT_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-2-9b-it:free",
  "meta-llama/llama-3.2-3b-instruct:free",
];

type ORModel = {
  id: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  architecture?: { modality?: string; tokenizer?: string };
};

// Fetch the live list of free text models from OpenRouter, sorted best-first
async function fetchLiveFreeModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      // Next.js caches this for 3 minutes so we don't hammer the endpoint
      next: { revalidate: 180 },
    });
    if (!res.ok) return EMERGENCY_TEXT_MODELS;
    const { data } = await res.json() as { data: ORModel[] };

    return (data ?? [])
      .filter(m =>
        m.id.endsWith(":free") &&
        String(m.pricing?.prompt ?? "1") === "0" &&
        // skip image-generation-only models
        !(m.architecture?.modality ?? "").startsWith("image->image")
      )
      .sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0))
      .map(m => m.id)
      .slice(0, 20);
  } catch {
    return EMERGENCY_TEXT_MODELS;
  }
}

function extractJson(raw: string): Record<string, unknown> | null {
  // 1. Strip DeepSeek / reasoning <think>...</think> blocks
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // 2. Strip markdown fences
  text = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

  // 3. Try parsing the whole cleaned text
  try { return JSON.parse(text) as Record<string, unknown>; } catch { /* continue */ }

  // 4. Find the outermost { ... } block and parse that
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]) as Record<string, unknown>; } catch { /* continue */ }

    // 5. Attempt common JSON repairs on the matched block
    try {
      const fixed = match[0]
        .replace(/,\s*([}\]])/g, "$1")               // trailing commas
        .replace(/([{,]\s*)(\w[\w\s]*)(\s*):/g, (_, pre, key, sp) =>
          `${pre}"${key.trim()}"${sp}:`)              // unquoted keys
        .replace(/:\s*'([^']*)'/g, ': "$1"');         // single-quoted values
      return JSON.parse(fixed) as Record<string, unknown>;
    } catch { /* continue */ }
  }

  // 6. Last resort: build a minimal valid response from raw text
  // so the admin still gets the analysis even without BOQ
  return {
    analysis: raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim().slice(0, 3000),
    total_cost: 0,
    bill_of_quantity: [],
  };
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: object[],
  maxTokens = 4096,
): Promise<string> {
  const res = await fetch(OPENROUTER_BASE, {
    method: "POST",
    headers: { ...HEADERS_BASE, Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      // Suppress chain-of-thought / thinking tokens (DeepSeek R1, QwQ, etc.)
      reasoning: { effort: "low" },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter [${model}] ${res.status}: ${err}`);
  }
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? "") as string;
}

// Try each model; skip on 4xx/5xx that signal unavailability or rate-limiting
async function callWithFallback(
  apiKey: string,
  models: string[],
  messages: object[],
  maxTokens = 4096,
): Promise<string> {
  const errors: string[] = [];
  for (const model of models) {
    try {
      const result = await callOpenRouter(apiKey, model, messages, maxTokens);
      if (result.trim()) return result;
      errors.push(`[${model}]: empty response`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg);
      // Only continue to next model if it's a transient/availability error
      const skip =
        msg.includes("429") || msg.includes("402") || msg.includes("404") ||
        msg.includes("rate") || msg.includes("unavailable") ||
        msg.includes("No endpoints") || msg.includes("free");
      if (!skip) throw e;
    }
  }
  throw new Error(`All models failed:\n${errors.slice(0, 5).join("\n")}`);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await request.json();
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENROUTER_API_KEY not configured" }, { status: 500 });

  const { data: project } = await supabase
    .from("projects")
    .select("title, description, location_address")
    .eq("id", projectId)
    .single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data: uploads } = await supabase
    .from("uploads")
    .select("file_name, file_type, public_url, category")
    .eq("project_id", projectId);

  const allUploads = uploads ?? [];
  const imageUploads = allUploads.filter(u => IMAGE_TYPES.has((u.file_type ?? "").toLowerCase()));
  const docUploads   = allUploads.filter(u => !IMAGE_TYPES.has((u.file_type ?? "").toLowerCase()));

  try {
    // ── STEP 1: Vision — extract info from drawing images ─────────────────────
    let extractedInfo = "No image drawings uploaded. Use project description and document names only.";

    if (imageUploads.length > 0) {
      const visionContent: ContentPart[] = [
        {
          type: "text",
          text: `You are a construction document reader. Carefully examine the attached engineering drawings and images.

Extract and list ALL visible information:
- Building dimensions (length, width, height, floor areas in m²)
- Number of floors and rooms
- Structural elements (foundations, columns, beams, slabs, walls)
- Materials mentioned or shown (concrete grade, steel type, block type)
- Any visible quantities, reinforcement details, or specifications
- Window and door counts and sizes
- Roof type and area
- Any notes, legends, or annotations on the drawings

Be as specific and detailed as possible.`,
        },
        ...imageUploads.map((u): ImagePart => ({
          type: "image_url",
          image_url: { url: u.public_url },
        })),
      ];

      extractedInfo = await callWithFallback(
        apiKey,
        VISION_MODELS,
        [{ role: "user", content: visionContent }],
        2048,
      );
    }

    // ── STEP 2: Text synthesis — generate professional BOQ ────────────────────
    // Fetch the live list of available free models dynamically
    const liveModels = await fetchLiveFreeModels(apiKey);
    const synthesisModels = liveModels.length > 0 ? liveModels : EMERGENCY_TEXT_MODELS;

    const synthesisPrompt = `You are a senior construction quantity surveyor in Saudi Arabia. Based on the project details and drawing analysis below, produce a complete professional construction quotation.

PROJECT DETAILS:
- Title: ${project.title}
- Description: ${project.description ?? "Not provided"}
- Location: ${project.location_address ?? "Not provided"}
${docUploads.length > 0 ? `- Supporting documents: ${docUploads.map(u => u.file_name).join(", ")}` : ""}

DRAWING ANALYSIS (extracted by AI vision):
${extractedInfo}

INSTRUCTIONS:
1. Use the extracted drawing data as the primary source for quantities
2. Apply realistic Saudi Arabian construction unit rates in SAR
3. Cover ALL major work items: site preparation, foundations, structure, masonry, finishing, MEP, external works
4. Each BOQ item must have realistic qty, unit, unit_price, and total (total = qty × unit_price)
5. The grand total_cost must equal the sum of all BOQ item totals

OUTPUT FORMAT: Reply with ONLY a raw JSON object. No markdown fences, no explanation, no thinking, no extra text before or after. Start your reply with { and end with }.

{
  "analysis": "Professional summary of project scope, key observations, and construction approach",
  "total_cost": 150000,
  "bill_of_quantity": [
    { "item": "Site Preparation", "qty": 200, "unit": "m²", "unit_price": 25, "total": 5000 }
  ]
}`;

    const synthesisRaw = await callWithFallback(
      apiKey,
      synthesisModels,
      [{ role: "user", content: synthesisPrompt }],
      4096,
    );

    // extractJson always returns an object (falls back to raw analysis text if unparseable)
    const parsed = extractJson(synthesisRaw) ?? {
      analysis: synthesisRaw.slice(0, 2000),
      total_cost: 0,
      bill_of_quantity: [],
    };

    const boq: Array<{ item: string; qty: number; unit: string; unit_price: number; total: number }> =
      Array.isArray(parsed.bill_of_quantity) ? parsed.bill_of_quantity : [];
    const computedTotal = boq.reduce((s, r) => s + (Number(r.total) || 0), 0);
    const finalTotal = computedTotal > 0 ? computedTotal : (Number(parsed.total_cost) || 0);

    return NextResponse.json({
      total_cost: finalTotal,
      ai_analysis: typeof parsed.analysis === "string" ? parsed.analysis : synthesisRaw.slice(0, 1000),
      bill_of_quantity: boq,
      drawing_extraction: extractedInfo,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
