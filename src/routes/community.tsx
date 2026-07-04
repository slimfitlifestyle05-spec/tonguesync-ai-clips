import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listCommunityIdeas,
  createCommunityIdea,
  updateCommunityIdea,
  deleteCommunityIdea,
  toggleCommunityVote,
  getMyVotes,
  isAdminCheck,
  type CommunityIdea,
} from "@/lib/community.functions";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Sparkles,
  Heart,
  FileText,
  Upload,
  Loader2,
  Trash2,
  Pencil,
  Plus,
  ArrowLeft,
} from "lucide-react";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Community — Trending short video ideas | TongueSync AI" },
      {
        name: "description",
        content:
          "Trending short-form video ideas from the TongueSync community, with step-by-step PDF playbooks you can download and run today.",
      },
      { property: "og:title", content: "TongueSync Community — Trending short ideas" },
      {
        property: "og:description",
        content: "Fresh short video ideas + PDF playbooks curated by the TongueSync team.",
      },
    ],
  }),
  component: CommunityPage,
});

function CommunityPage() {
  const qc = useQueryClient();
  const list = useServerFn(listCommunityIdeas);
  const votes = useServerFn(getMyVotes);
  const admin = useServerFn(isAdminCheck);

  const ideasQ = useQuery({ queryKey: ["community-ideas"], queryFn: () => list() });
  const votesQ = useQuery({ queryKey: ["community-my-votes"], queryFn: () => votes(), retry: false });
  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => admin(), retry: false });

  const myVotes = new Set(votesQ.data ?? []);
  const isAdmin = adminQ.data?.isAdmin === true;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/"><Logo /></Link>
        <nav className="flex items-center gap-2">
          <LangToggle />
          <Link to="/"><Button variant="ghost" className="text-white hover:bg-white/10"><ArrowLeft className="h-4 w-4 mr-1" /> Home</Button></Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 pt-8 pb-14 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
          <Sparkles className="h-3 w-3 text-amber-300" /> Community
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-fuchsia-300 via-white to-amber-200 bg-clip-text text-transparent">
          Trending short video ideas
        </h1>
        <p className="mt-4 text-slate-300 text-lg max-w-2xl mx-auto">
          Fresh ideas curated by the TongueSync team — with downloadable PDF playbooks that walk you through exactly how to make each one.
        </p>
      </section>

      {isAdmin ? (
        <section className="mx-auto max-w-4xl px-6 pb-8">
          <AdminPanel onSaved={() => qc.invalidateQueries({ queryKey: ["community-ideas"] })} />
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-6 pb-24">
        {ideasQ.isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 bg-white/5" />
            ))}
          </div>
        ) : (ideasQ.data ?? []).length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-slate-300">
            No ideas yet. Check back soon — we drop new ones every week.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {(ideasQ.data ?? []).map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                voted={myVotes.has(idea.id)}
                isAdmin={isAdmin}
                onChange={() => {
                  qc.invalidateQueries({ queryKey: ["community-ideas"] });
                  qc.invalidateQueries({ queryKey: ["community-my-votes"] });
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function IdeaCard({
  idea,
  voted,
  isAdmin,
  onChange,
}: {
  idea: CommunityIdea;
  voted: boolean;
  isAdmin: boolean;
  onChange: () => void;
}) {
  const vote = useServerFn(toggleCommunityVote);
  const del = useServerFn(deleteCommunityIdea);
  const [editing, setEditing] = useState(false);

  const voteM = useMutation({
    mutationFn: () => vote({ data: { ideaId: idea.id } }),
    onSuccess: () => onChange(),
    onError: (e: any) => toast.error(e?.message ?? "Sign in to vote"),
  });

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur transition hover:border-fuchsia-400/40">
      {idea.thumbnail_signed_url ? (
        <img src={idea.thumbnail_signed_url} alt={idea.title} className="h-40 w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-fuchsia-500/20 to-amber-400/20">
          <Sparkles className="h-10 w-10 text-white/50" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
          <Badge variant="outline" className="border-white/20 text-slate-300">{idea.category}</Badge>
          {idea.tags.slice(0, 3).map((t) => (
            <span key={t} className="text-fuchsia-300">#{t}</span>
          ))}
        </div>
        <h3 className="text-lg font-semibold leading-snug text-white">{idea.title}</h3>
        {idea.hook ? <p className="text-sm text-amber-200/90 italic">“{idea.hook}”</p> : null}
        <p className="text-sm text-slate-300 line-clamp-4 whitespace-pre-wrap">{idea.description}</p>
        {idea.cta ? <p className="text-xs text-slate-400"><span className="text-slate-500">CTA:</span> {idea.cta}</p> : null}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => voteM.mutate()}
            disabled={voteM.isPending}
            className={
              "border-white/10 " +
              (voted ? "bg-fuchsia-500/20 text-fuchsia-200" : "bg-white/5 text-slate-200 hover:bg-white/10")
            }
          >
            <Heart className={"h-4 w-4 mr-1 " + (voted ? "fill-fuchsia-300 text-fuchsia-300" : "")} />
            {idea.votes}
          </Button>
          {idea.pdf_signed_url ? (
            <a href={idea.pdf_signed_url} target="_blank" rel="noreferrer">
              <Button size="sm" className="bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold hover:opacity-90">
                <FileText className="h-4 w-4 mr-1" /> PDF playbook
              </Button>
            </a>
          ) : null}
          {isAdmin ? (
            <>
              <Button size="sm" variant="ghost" className="text-slate-300 hover:bg-white/10" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-300 hover:bg-red-500/10"
                onClick={async () => {
                  if (!confirm("Delete this idea?")) return;
                  try {
                    await del({ data: { id: idea.id } });
                    toast.success("Deleted");
                    onChange();
                  } catch (e: any) {
                    toast.error(e?.message ?? "Delete failed");
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {editing ? (
        <EditIdeaOverlay
          idea={idea}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChange();
          }}
        />
      ) : null}
    </article>
  );
}

function AdminPanel({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-amber-300/20 bg-amber-500/5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-amber-200">Admin</div>
          <div className="text-xs text-slate-400">Add a new trending idea with a PDF playbook.</div>
        </div>
        <Button
          onClick={() => setOpen((v) => !v)}
          className="bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold hover:opacity-90"
        >
          <Plus className="h-4 w-4 mr-1" /> {open ? "Close" : "New idea"}
        </Button>
      </div>
      {open ? (
        <div className="mt-4">
          <IdeaForm onSaved={() => { setOpen(false); onSaved(); }} />
        </div>
      ) : null}
    </div>
  );
}

function EditIdeaOverlay({
  idea,
  onClose,
  onSaved,
}: {
  idea: CommunityIdea;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Edit idea</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        <IdeaForm existing={idea} onSaved={onSaved} />
      </div>
    </div>
  );
}

function IdeaForm({ existing, onSaved }: { existing?: CommunityIdea; onSaved: () => void }) {
  const create = useServerFn(createCommunityIdea);
  const update = useServerFn(updateCommunityIdea);

  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [category, setCategory] = useState(existing?.category ?? "general");
  const [tags, setTags] = useState((existing?.tags ?? []).join(", "));
  const [hook, setHook] = useState(existing?.hook ?? "");
  const [cta, setCta] = useState(existing?.cta ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(existing?.thumbnail_url ?? "");
  const [pdfUrl, setPdfUrl] = useState(existing?.pdf_url ?? "");
  const [published, setPublished] = useState(existing?.is_published ?? true);
  const [thumbBusy, setThumbBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  async function upload(file: File, kind: "thumb" | "pdf") {
    const ext = file.name.split(".").pop() ?? (kind === "pdf" ? "pdf" : "jpg");
    const path = `${kind}s/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("community").upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (error) throw error;
    return path;
  }

  async function onThumb(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setThumbBusy(true);
    try {
      const path = await upload(f, "thumb");
      setThumbnailUrl(path);
      toast.success("Thumbnail uploaded");
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setThumbBusy(false);
    }
  }

  async function onPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) return toast.error("Max 20MB");
    setPdfBusy(true);
    try {
      const path = await upload(f, "pdf");
      setPdfUrl(path);
      toast.success("PDF uploaded");
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setPdfBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        category: category.trim() || "general",
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        hook: hook.trim() || null,
        cta: cta.trim() || null,
        thumbnail_url: thumbnailUrl.trim() || null,
        pdf_url: pdfUrl.trim() || null,
        is_published: published,
      };
      if (existing) {
        await update({ data: { id: existing.id, ...payload } });
        toast.success("Idea updated");
      } else {
        await create({ data: payload });
        toast.success("Idea published");
      }
      onSaved();
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div>
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required className="bg-white/5 border-white/10 mt-1" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Category</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} className="bg-white/5 border-white/10 mt-1" placeholder="e.g. storytelling" />
        </div>
        <div>
          <Label>Tags (comma separated)</Label>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} className="bg-white/5 border-white/10 mt-1" placeholder="tiktok, arabic, viral" />
        </div>
      </div>
      <div>
        <Label>Hook (one-line opener)</Label>
        <Input value={hook} onChange={(e) => setHook(e.target.value)} className="bg-white/5 border-white/10 mt-1" />
      </div>
      <div>
        <Label>Description / playbook summary</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} required className="bg-white/5 border-white/10 mt-1" />
      </div>
      <div>
        <Label>Call to action</Label>
        <Input value={cta} onChange={(e) => setCta(e.target.value)} className="bg-white/5 border-white/10 mt-1" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Thumbnail</Label>
          <div className="mt-1 flex items-center gap-2">
            <Input type="file" accept="image/*" onChange={onThumb} disabled={thumbBusy} className="bg-white/5 border-white/10" />
            {thumbBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          </div>
          <Input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} placeholder="or paste a URL / storage path" className="mt-2 bg-white/5 border-white/10 text-xs" />
        </div>
        <div>
          <Label>PDF playbook</Label>
          <div className="mt-1 flex items-center gap-2">
            <Input type="file" accept="application/pdf" onChange={onPdf} disabled={pdfBusy} className="bg-white/5 border-white/10" />
            {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-slate-400" />}
          </div>
          <Input value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} placeholder="or paste a URL / storage path" className="mt-2 bg-white/5 border-white/10 text-xs" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={published} onCheckedChange={setPublished} />
        <span className="text-sm">Published</span>
      </div>

      <Button type="submit" disabled={saving} className="bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold hover:opacity-90">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {existing ? "Save changes" : "Publish idea"}
      </Button>
    </form>
  );
}