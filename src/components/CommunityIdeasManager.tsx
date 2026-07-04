import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listCommunityIdeasAdmin,
  createCommunityIdea,
  updateCommunityIdea,
  deleteCommunityIdea,
  resetCommunityVotes,
  isAdminCheck,
  type CommunityIdea,
} from "@/lib/community.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { FileText, Upload, Loader2, Trash2, Pencil, Plus, Sparkles, ImageIcon, Heart, Eye, EyeOff, RotateCcw } from "lucide-react";

export function CommunityIdeasManager() {
  const qc = useQueryClient();
  const list = useServerFn(listCommunityIdeasAdmin);
  const admin = useServerFn(isAdminCheck);
  const del = useServerFn(deleteCommunityIdea);
  const update = useServerFn(updateCommunityIdea);
  const resetVotes = useServerFn(resetCommunityVotes);

  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => admin(), retry: false });
  const isAdmin = adminQ.data?.isAdmin === true;
  const ideasQ = useQuery({
    queryKey: ["community-ideas-admin"],
    queryFn: () => list(),
    enabled: isAdmin,
    retry: false,
  });

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CommunityIdea | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["community-ideas-admin"] });
    qc.invalidateQueries({ queryKey: ["community-ideas"] });
  };

  const deleteM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  async function togglePublished(idea: CommunityIdea) {
    setBusyId(idea.id);
    try {
      await update({ data: { id: idea.id, is_published: !idea.is_published } });
      toast.success(idea.is_published ? "Unpublished" : "Published");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onResetVotes(idea: CommunityIdea) {
    if (!confirm(`Reset likes for "${idea.title}" back to 0?`)) return;
    setBusyId(idea.id);
    try {
      await resetVotes({ data: { id: idea.id } });
      toast.success("Likes reset to 0");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Reset failed");
    } finally {
      setBusyId(null);
    }
  }

  if (adminQ.isLoading) return <Skeleton className="h-32 bg-white/5" />;
  if (!isAdmin) return null;

  return (
    <section className="rounded-2xl border border-amber-300/20 bg-amber-500/5 p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="text-sm font-semibold text-amber-200 flex items-center gap-2"><Sparkles className="h-4 w-4" /> Community ideas</div>
          <div className="text-xs text-slate-400">Add, edit or remove trending short-video ideas (with images &amp; PDF playbooks).</div>
        </div>
        <Button
          onClick={() => { setCreating(true); setEditing(null); }}
          className="bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold hover:opacity-90"
        >
          <Plus className="h-4 w-4 mr-1" /> New idea
        </Button>
      </div>

      {creating ? (
        <div className="mb-6 rounded-xl border border-white/10 bg-slate-900/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold">New idea</h4>
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>Close</Button>
          </div>
          <IdeaForm onSaved={() => { setCreating(false); refetch(); }} />
        </div>
      ) : null}

      {ideasQ.isLoading ? (
        <Skeleton className="h-24 bg-white/5" />
      ) : (ideasQ.data ?? []).length === 0 ? (
        <div className="text-sm text-slate-400">No ideas yet. Add the first one.</div>
      ) : (
        <div className="grid gap-3">
          {(ideasQ.data ?? []).map((idea) => (
            <div key={idea.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              {idea.thumbnail_signed_url ? (
                <img src={idea.thumbnail_signed_url} alt="" className="h-14 w-14 rounded-lg object-cover" loading="lazy" />
              ) : (
                <div className="h-14 w-14 rounded-lg bg-gradient-to-br from-fuchsia-500/30 to-amber-400/30 flex items-center justify-center">
                  <ImageIcon className="h-5 w-5 text-white/60" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium truncate">{idea.title}</div>
                  <Badge variant="outline" className="border-white/20 text-slate-300 text-[10px]">{idea.category}</Badge>
                  {!idea.is_published ? <Badge className="bg-slate-700 text-slate-200 text-[10px]">Draft</Badge> : null}
                  {idea.pdf_signed_url ? <Badge className="bg-fuchsia-500/20 text-fuchsia-200 text-[10px]"><FileText className="h-3 w-3 mr-1" />PDF</Badge> : null}
                  <Badge className="bg-rose-500/20 text-rose-200 text-[10px]"><Heart className="h-3 w-3 mr-1 fill-rose-300 text-rose-300" />{idea.votes} {idea.votes === 1 ? "like" : "likes"}</Badge>
                </div>
                <div className="text-xs text-slate-400 truncate">{idea.description}</div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === idea.id}
                  className={idea.is_published ? "text-emerald-300 hover:bg-emerald-500/10" : "text-slate-400 hover:bg-white/10"}
                  title={idea.is_published ? "Unpublish (hide from public)" : "Publish (show to public)"}
                  onClick={() => togglePublished(idea)}
                >
                  {busyId === idea.id ? <Loader2 className="h-4 w-4 animate-spin" /> : idea.is_published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === idea.id || idea.votes === 0}
                  className="text-rose-300 hover:bg-rose-500/10"
                  title="Reset likes to 0"
                  onClick={() => onResetVotes(idea)}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="text-slate-300 hover:bg-white/10" onClick={() => { setEditing(idea); setCreating(false); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-300 hover:bg-red-500/10"
                  onClick={() => { if (confirm("Delete this idea?")) deleteM.mutate(idea.id); }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setEditing(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit idea</h3>
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Close</Button>
            </div>
            <IdeaForm existing={editing} onSaved={() => { setEditing(null); refetch(); }} />
          </div>
        </div>
      ) : null}
    </section>
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
      toast.success("Image uploaded");
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
          <Label>Image / thumbnail</Label>
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