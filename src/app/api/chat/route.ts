import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { message, sessionId } = await request.json();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase.from("chat_messages").insert({
    user_id: user.id,
    session_id: sessionId,
    role: "user",
    content: message,
  });

  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(20);

  const messages = [
    {
      role: "system" as const,
      content: `You are a helpful construction quotation assistant. You help clients understand their construction project quotations, explain material quantities, costs, and building processes. Be concise, friendly, and professional. If asked about specific pricing, note that these are estimates and actual costs may vary.`,
    },
    ...(history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b:free",
        messages,
        stream: true,
      }),
    });

    await supabase.from("chat_messages").insert({
      user_id: user.id,
      session_id: sessionId,
      role: "assistant",
      content: "[streaming]",
    });

    return new Response(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to get response" }, { status: 500 });
  }
}
