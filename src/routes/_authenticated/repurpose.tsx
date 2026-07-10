import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Copy, Loader2, Linkedin, Twitter, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { hasGeminiKey, repurposeTranscript, type RepurposeResult } from "@/lib/repurpose-client";

export const Route = createFileRoute("/_authenticated/repurpose")({
  head: () => ({
    meta: [
      { title: "Long-form → LinkedIn Post & X Thread — TongueSync AI" },
      { name: "description", content: "Turn any long video transcript into a viral LinkedIn post and an X thread in one click, powered by your own Gemini key." },
    ],
  }),
  component: RepurposePage,
});

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="border-white/15 bg-white/5 hover:bg-white/10"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success("Copied to clipboard");
          setTimeout(() => setCopied(false), 1600);
        } catch {
          toast.error("Couldn't copy — select and copy manually");
        }
      }}
    >
      {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function RepurposePage() {
  const [transcript, setTranscript] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RepurposeResult | null>(null);
  const keyOk = hasGeminiKey();

  async function run() {
    if (!keyOk) {
      toast.error("Add your VITE_GEMINI_API_KEY in Dashboard settings first.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const r = await repurposeTranscript(title ? `Title: ${title}\n\n${transcript}` : transcript);
      setResult(r);
      toast.success("Ready — LinkedIn post + X thread generated");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  const threadJoined = result?.x_thread.join("\n\n") ?? "";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 border-b border-white/5">
        <Link to="/"><Logo /></Link>
        <div className="flex items-center gap-2">
          <LangToggle />
          <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-fuchsia-500 text-black">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Video → LinkedIn Post & X Thread</h1>
            <p className="text-slate-400 text-sm">Paste your long-form video transcript. Gemini rewrites it into a polished LinkedIn post and a viral X thread.</p>
          </div>
        </div>

        {!keyOk && (
          <div className="mb-6 rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            Add <code className="rounded bg-black/40 px-1.5 py-0.5">VITE_GEMINI_API_KEY</code> to your project env to enable this feature (client-side, uses your personal quota).
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wider text-fuchsia-300/80 font-semibold">Input</div>
              <h2 className="text-lg font-semibold">Your video transcript</h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Video title (optional)</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 3 pricing mistakes killing your SaaS"
                  className="bg-white/5 border-white/10 mt-1"
                />
              </div>
              <div>
                <Label>Transcript</Label>
                <Textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Paste the full transcript here (or subtitles). Minimum ~40 characters."
                  rows={16}
                  className="bg-white/5 border-white/10 mt-1 font-mono text-xs leading-relaxed"
                />
                <div className="mt-1 text-[10px] text-slate-500">{transcript.length.toLocaleString()} characters</div>
              </div>
              <Button
                type="button"
                onClick={run}
                disabled={loading || !transcript.trim()}
                className="w-full bg-gradient-to-r from-sky-500 to-fuchsia-500 text-black font-semibold"
              >
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</> : "Generate LinkedIn + X thread"}
              </Button>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Linkedin className="h-4 w-4 text-sky-400" />
                  <h3 className="text-sm font-semibold">LinkedIn post</h3>
                </div>
                {result?.linkedin_post && <CopyButton text={result.linkedin_post} />}
              </div>
              {result?.linkedin_post ? (
                <pre className="whitespace-pre-wrap break-words rounded-lg bg-black/30 border border-white/10 p-4 text-sm leading-relaxed font-sans">{result.linkedin_post}</pre>
              ) : (
                <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-xs text-slate-500">
                  Your polished LinkedIn post will appear here.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Twitter className="h-4 w-4 text-sky-300" />
                  <h3 className="text-sm font-semibold">X thread</h3>
                </div>
                {result && <CopyButton text={threadJoined} />}
              </div>
              {result?.x_thread?.length ? (
                <ol className="space-y-3">
                  {result.x_thread.map((t, i) => (
                    <li key={i} className="rounded-lg bg-black/30 border border-white/10 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed flex-1">{t}</p>
                        <CopyButton text={t} />
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-xs text-slate-500">
                  Your viral X thread will appear here, one tweet per row.
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}