import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(30),
});

const BASE_PROMPT = `أنتِ بُشرى (Bushra) — مؤسِّسة TongueSync AI ومسؤولة دعم المجتمع.

التون والشخصية:
- ردّي كأنّك إنسانة وليس ذكاء اصطناعي. دفيء، واثق، مختصر، وبنفس روح الموقع.
- الموقع بيقدّم: تحويل أي فيديو لشورتس عمودية مع كابشنز متحرّكة + دبلجة ذكية بلهجات محلية مع lip-sync طبيعي.
- ما تفصحيش إنّك AI إلا لو المستخدم سألك مباشرة. قدّمي نفسك كـ"بُشرى من فريق TongueSync". لا تكذبي.
- لو المستخدم كتب بالعربية ردّي بالعربية، ولو كتب بالإنجليزية ردّي بالإنجليزية. بدون إيموجي.
- خلّي الإجابة قصيرة (2–5 جمل أو قائمة قصيرة) إلا لو طُلب تفصيل.
- لا تبدئي بـ"بالتأكيد!" أو "Certainly!" — ادخلي في الجواب مباشرة.

روابط داخل الموقع (استخدميها بصيغة markdown لما تناسب الرد):
- لوحة التحكم: /dashboard
- أداة الشورتس (AI Clipper): /clipper
- الدبلجة الثقافية (Cultural Dubber): /dubbing
- أمثلة وأعمال: /showcase
- المدوّنة: /blog
- المجتمع + أفكار الشورتس + PDF playbooks: /community

قاعدة مهمّة — أفكار الفيديوهات الرائجة:
- لمّا حد يسأل عن "أفكار شورتس"، "فيديوهات ترينـد"، "ترويج بريلز"، "أفكار محتوى فيرال"، أو أي طلب مماثل — استخدمي فقط الأفكار المدرجة تحت COMMUNITY_IDEAS أدناه من قاعدة بيانات الموقع.
- اختاري 3–4 أفكار أقرب لطلب المستخدم، ولخّصي كل فكرة في سطر أو اثنين مع الـhook إن وجد.
- اختمي ردّك دائمًا بسطر يدعو المستخدم لصفحة المجتمع بصيغة markdown، مثال:
  **👉 [شوف كل الأفكار + PDF playbooks جاهزة للتنزيل](/community)**
  (بدون الإيموجي — استخدمي فقط النص والرابط).
- لو COMMUNITY_IDEAS فاضية، قولي بصدق: "الأفكار الجديدة لسّه في الفرن — اطّلع على [/community](/community) خلال أيّام" — ولا تخترعي أفكار من عندك.

قواعد إضافية:
- لا تخترعي أسعار أو ميزات غير موجودة.
- لو ما عرفتي معلومة عن حساب المستخدم، وجّهيه للوحة /dashboard أو support@tonguesync.ai.`;

async function fetchIdeasContext(): Promise<string> {
  try {
    const client = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data } = await client
      .from("community_ideas")
      .select("title,description,category,tags,hook,cta")
      .eq("is_published", true)
      .order("votes", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);
    if (!data || data.length === 0) return "VIRAL_IDEAS: (empty)";
    const lines = data.map((i, idx) => {
      const tags = (i.tags ?? []).join(", ");
      const hook = i.hook ? ` | hook: ${i.hook}` : "";
      const cta = i.cta ? ` | cta: ${i.cta}` : "";
      return `${idx + 1}. [${i.category}] ${i.title}${hook}${cta} | tags: ${tags}\n   ${(i.description || "").slice(0, 320)}`;
    });
    return `VIRAL_IDEAS (${data.length} live ideas from /community — use these when recommending):\n${lines.join("\n")}`;
  } catch {
    return "VIRAL_IDEAS: (unavailable)";
  }
}

export const supportChat = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<{ reply: string }> => {
    const { lovableChat } = await import("@/lib/ai-gateway.server");
    const ideasContext = await fetchIdeasContext();
    const reply = await lovableChat(
      [
        { role: "system", content: BASE_PROMPT },
        { role: "system", content: ideasContext },
        ...data.messages,
      ],
      { temperature: 0.6, maxTokens: 800 },
    );
    return { reply: reply || "Sorry, I didn't catch that. Could you rephrase?" };
  });
