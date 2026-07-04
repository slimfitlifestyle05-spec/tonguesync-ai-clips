import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const BASE_URL = "https://tonguesync-ai-clips.lovable.app";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/about", changefreq: "monthly", priority: "0.6" },
          { path: "/contact", changefreq: "monthly", priority: "0.6" },
          { path: "/showcase", changefreq: "weekly", priority: "0.7" },
          { path: "/community", changefreq: "weekly", priority: "0.8" },
          { path: "/blog", changefreq: "weekly", priority: "0.8" },
          { path: "/compare", changefreq: "monthly", priority: "0.7" },
          { path: "/compare/heygen", changefreq: "monthly", priority: "0.8" },
          { path: "/compare/rask", changefreq: "monthly", priority: "0.8" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
        ];

        try {
          const supabase = createClient<Database>(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
          );
          const { data: posts } = await supabase
            .from("blog_posts")
            .select("slug, published_at")
            .eq("published", true)
            .order("published_at", { ascending: false });
          for (const p of posts ?? []) {
            if (!p.slug) continue;
            entries.push({
              path: `/blog/${p.slug}`,
              lastmod: p.published_at ? new Date(p.published_at).toISOString().slice(0, 10) : undefined,
              changefreq: "monthly",
              priority: "0.7",
            });
          }
          const { data: ideas } = await supabase
            .from("community_ideas")
            .select("updated_at")
            .eq("is_published", true)
            .order("updated_at", { ascending: false })
            .limit(1);
          const ideaLast = ideas?.[0]?.updated_at;
          if (ideaLast) {
            const comm = entries.find((e) => e.path === "/community");
            if (comm) comm.lastmod = new Date(ideaLast).toISOString().slice(0, 10);
          }
        } catch {
          // dynamic content unavailable; static entries still ship
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
