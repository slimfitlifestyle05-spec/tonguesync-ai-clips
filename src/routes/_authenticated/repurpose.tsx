import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Copy, Loader2, Linkedin, Twitter, Sparkles, Check, Share2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  generateLinkedInPost,
  generateXThread,
  hasGeminiKey,
  shareOnLinkedIn,
  shareOnX,
} from "@/lib/repurpose-client";

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
  const [linkedin, setLinkedin] = useState<string | null>(null);
  const [thread, setThread] = useState<string[] | null>(null);
  const [loadingLI, setLoadingLI] = useState(false);
  const [loadingX, setLoadingX] = useState(false);
  const keyOk = hasGeminiKey();

  const composed = () => (title ? `Title: ${title}\n\n${transcript}` : transcript);

  async function runLinkedIn() {
    if (!keyOk) { toast.error("Add your VITE_GEMINI_API_KEY in Dashboard settings first."); return; }
    setLoadingLI(true); setLinkedin(null);
    try {
      const post = await generateLinkedInPost(composed());
      setLinkedin(post);
      toast.success("LinkedIn post ready");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setLoadingLI(false); }
  }
  async function runThread() {
    if (!keyOk) { toast.error("Add your VITE_GEMINI_API_KEY in Dashboard settings first."); return; }
    setLoadingX(true); setThread(null);
    try {
      const t = await generateXThread(composed());
      setThread(t);
      toast.success("X thread ready");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setLoadingX(false); }
  }

  const threadJoined = thread?.join("\n\n") ?? "";

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
              <p className="text-[11px] text-slate-500">
                Pick a tab on the right and click <b>Generate</b> — each artisan runs its own hand-tuned Gemini prompt, so you can iterate on one without regenerating the other.
              </p>
            </div>
          </section>

          <section>
            <Tabs defaultValue="thread" className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <TabsList className="mb-4 grid grid-cols-2 bg-white/5">
                <TabsTrigger value="thread" className="data-[state=active]:bg-fuchsia-500/20">
                  <Twitter className="h-4 w-4 mr-1.5 text-sky-300" /> X Thread Artisan
                </TabsTrigger>
                <TabsTrigger value="linkedin" className="data-[state=active]:bg-sky-500/20">
                  <Linkedin className="h-4 w-4 mr-1.5 text-sky-400" /> LinkedIn Post Creator
                </TabsTrigger>
              </TabsList>

              {/* ───── X Thread ───── */}
              <TabsContent value="thread" className="mt-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={runThread}
                    disabled={loadingX || !transcript.trim()}
                    className="bg-gradient-to-r from-sky-500 to-fuchsia-500 text-black font-semibold"
                  >
                    {loadingX ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> AI is crafting your thread…</> : "Generate X Thread"}
                  </Button>
                  {thread && <CopyButton text={threadJoined} />}
                  {thread && (
                    <Button
                      type="button"
                      size="sm"
                      className="bg-black text-white hover:bg-black/80"
                      onClick={() => shareOnX(thread[0])}
                      title="Opens x.com pre-filled with tweet 1. Paste follow-up tweets as replies."
                    >
                      <Send className="h-4 w-4 mr-1" /> Share on X
                    </Button>
                  )}
                </div>
                {loadingX && !thread && (
                  <div className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-2">
                    <div className="h-2 w-1/3 bg-fuchsia-500/40 rounded animate-pulse" />
                    <div className="h-3 w-full bg-white/10 rounded animate-pulse" />
                    <div className="h-3 w-5/6 bg-white/10 rounded animate-pulse" />
                    <div className="h-3 w-3/5 bg-white/10 rounded animate-pulse" />
                    <div className="mt-2 text-[10px] text-slate-500">AI is crafting your post…</div>
                  </div>
                )}
                {thread?.length ? (
                  <ol className="space-y-3">
                    {thread.map((t: string, i: number) => (
                      <li key={i} className="rounded-lg bg-black/30 border border-white/10 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed flex-1">{t}</p>
                          <div className="flex flex-col gap-1 shrink-0">
                            <CopyButton text={t} />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-white/15 bg-white/5 hover:bg-white/10"
                              onClick={() => shareOnX(t)}
                              title="Share this tweet on X"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : !loadingX ? (
                  <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-xs text-slate-500">
                    Your viral X thread will appear here, one tweet per row.
                  </div>
                ) : null}
              </TabsContent>

              {/* ───── LinkedIn ───── */}
              <TabsContent value="linkedin" className="mt-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={runLinkedIn}
                    disabled={loadingLI || !transcript.trim()}
                    className="bg-gradient-to-r from-sky-500 to-fuchsia-500 text-black font-semibold"
                  >
                    {loadingLI ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> AI is crafting your post…</> : "Generate LinkedIn Post"}
                  </Button>
                  {linkedin && <CopyButton text={linkedin} />}
                  {linkedin && (
                    <Button
                      type="button"
                      size="sm"
                      className="bg-[#0A66C2] text-white hover:bg-[#0a66c2]/85"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(linkedin);
                          toast.success("Post copied — LinkedIn will open in a new tab, just paste and publish.");
                        } catch {
                          toast.message("Opening LinkedIn — select & copy the post text on the left first.");
                        }
                        shareOnLinkedIn();
                      }}
                      title="Copies the post and opens LinkedIn's official share window"
                    >
                      <Linkedin className="h-4 w-4 mr-1" /> Share on LinkedIn
                    </Button>
                  )}
                </div>
                {loadingLI && !linkedin && (
                  <div className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-2">
                    <div className="h-2 w-1/3 bg-fuchsia-500/40 rounded animate-pulse" />
                    <div className="h-3 w-full bg-white/10 rounded animate-pulse" />
                    <div className="h-3 w-11/12 bg-white/10 rounded animate-pulse" />
                    <div className="h-3 w-4/5 bg-white/10 rounded animate-pulse" />
                    <div className="h-3 w-3/5 bg-white/10 rounded animate-pulse" />
                    <div className="mt-2 text-[10px] text-slate-500">AI is crafting your post…</div>
                  </div>
                )}
                {linkedin ? (
                  <pre className="whitespace-pre-wrap break-words rounded-lg bg-black/30 border border-white/10 p-4 text-sm leading-relaxed font-sans">{linkedin}</pre>
                ) : !loadingLI ? (
                  <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-xs text-slate-500">
                    Your polished LinkedIn post will appear here.
                  </div>
                ) : null}
                <p className="text-[10px] text-slate-500">
                  LinkedIn's share intent only accepts a URL, so we auto-copy the post text to your clipboard and open LinkedIn — just paste (⌘/Ctrl-V) into the composer and hit Post.
                </p>
              </TabsContent>
            </Tabs>
          </section>
        </div>
      </main>
    </div>
  );
}