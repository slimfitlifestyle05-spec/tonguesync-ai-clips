import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { planUploadedClipMoments, writeClipCopyForTopic } from "./clip-copy-planner.server";

export const planClips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        base64: z.string().min(1),
        mimeType: z.string().min(1).max(100),
        topic: z.string().max(300).default(""),
        count: z.number().int().min(1).max(6).default(3),
        durationSeconds: z.number().min(0).max(60 * 60 * 4).default(0),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    return planUploadedClipMoments(data);
  });

export const generateCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        topic: z.string().max(500).default(""),
        clipIndex: z.number().int().min(0).max(20).default(0),
        variation: z.number().int().min(0).max(50).default(0),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    return writeClipCopyForTopic(data);
  });