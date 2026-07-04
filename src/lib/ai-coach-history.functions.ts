import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

export type StoredMessage = z.infer<typeof MessageSchema>;

export type ConversationSummary = {
  id: string;
  title: string;
  niche: string | null;
  topics: string | null;
  updated_at: string;
  message_count: number;
};

export type ConversationDetail = ConversationSummary & {
  messages: StoredMessage[];
  created_at: string;
};

export const listCoachConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConversationSummary[]> => {
    const { data, error } = await context.supabase
      .from("ai_coach_conversations")
      .select("id,title,niche,topics,updated_at,messages")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id as string,
      title: row.title as string,
      niche: (row.niche as string | null) ?? null,
      topics: (row.topics as string | null) ?? null,
      updated_at: row.updated_at as string,
      message_count: Array.isArray(row.messages) ? (row.messages as unknown[]).length : 0,
    }));
  });

export const getCoachConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ConversationDetail | null> => {
    const { data: row, error } = await context.supabase
      .from("ai_coach_conversations")
      .select("id,title,niche,topics,updated_at,created_at,messages")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const raw = Array.isArray(row.messages) ? (row.messages as unknown[]) : [];
    const messages: StoredMessage[] = [];
    for (const m of raw) {
      const parsed = MessageSchema.safeParse(m);
      if (parsed.success) messages.push(parsed.data);
    }
    return {
      id: row.id as string,
      title: row.title as string,
      niche: (row.niche as string | null) ?? null,
      topics: (row.topics as string | null) ?? null,
      updated_at: row.updated_at as string,
      created_at: row.created_at as string,
      message_count: messages.length,
      messages,
    };
  });

const UpsertSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(200),
  niche: z.string().max(200).optional().nullable(),
  topics: z.string().max(500).optional().nullable(),
  messages: z.array(MessageSchema).min(1).max(60),
});

export const upsertCoachConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpsertSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const payload = {
      user_id: context.userId,
      title: data.title.slice(0, 200),
      niche: data.niche ?? null,
      topics: data.topics ?? null,
      messages: data.messages,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("ai_coach_conversations")
        .update(payload)
        .eq("id", data.id)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (row?.id) return { id: row.id as string };
    }
    const { data: inserted, error: insErr } = await context.supabase
      .from("ai_coach_conversations")
      .insert(payload)
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    return { id: inserted.id as string };
  });

export const deleteCoachConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("ai_coach_conversations")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });