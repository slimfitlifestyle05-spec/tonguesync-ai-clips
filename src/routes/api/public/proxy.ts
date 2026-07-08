import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
};

// Simple server-side proxy so the ffmpeg.wasm muxer can fetch remote assets
// (video / audio) from origins that don't send CORS headers. Only allows
// http(s) URLs and forwards Range requests so ffmpeg can seek.
export const Route = createFileRoute("/api/public/proxy")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const u = new URL(request.url);
        const target = u.searchParams.get("url");
        if (!target) {
          return new Response("Missing url", { status: 400, headers: CORS });
        }
        let parsed: URL;
        try {
          parsed = new URL(target);
        } catch {
          return new Response("Invalid url", { status: 400, headers: CORS });
        }
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return new Response("Unsupported protocol", { status: 400, headers: CORS });
        }
        const headers: Record<string, string> = {};
        const range = request.headers.get("range");
        if (range) headers["Range"] = range;
        try {
          const upstream = await fetch(parsed.toString(), { headers, redirect: "follow" });
          const out = new Headers();
          for (const [k, v] of upstream.headers) {
            const lk = k.toLowerCase();
            if (
              lk === "content-type" ||
              lk === "content-length" ||
              lk === "content-range" ||
              lk === "accept-ranges" ||
              lk === "last-modified" ||
              lk === "etag"
            ) {
              out.set(k, v);
            }
          }
          for (const [k, v] of Object.entries(CORS)) out.set(k, v);
          return new Response(upstream.body, { status: upstream.status, headers: out });
        } catch (err: any) {
          return new Response(`Upstream fetch failed: ${err?.message ?? err}`, {
            status: 502,
            headers: CORS,
          });
        }
      },
    },
  },
});