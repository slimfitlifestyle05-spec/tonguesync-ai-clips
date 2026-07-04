import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getShowcaseVideos, updateShowcaseVideos } from "@/lib/showcase-videos.functions";
import { isAdminCheck } from "@/lib/community.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Video, Loader2, Save, Trash2 } from "lucide-react";

export function ShowcaseVideosAdmin() {
  const qc = useQueryClient();
  const admin = useServerFn(isAdminCheck);
  const fetchShowcase = useServerFn(getShowcaseVideos);
  const save = useServerFn(updateShowcaseVideos);

  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => admin(), retry: false });
  const isAdmin = adminQ.data?.isAdmin === true;
  const showcaseQ = useQuery({
    queryKey: ["showcase-videos-admin"],
    queryFn: () => fetchShowcase(),
    enabled: isAdmin,
  });

  const [arPath, setArPath] = useState<string | null>(null);
  const [enPath, setEnPath] = useState<string | null>(null);
  const [arCaption, setArCaption] = useState("");
  const [enCaption, setEnCaption] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [busy, setBusy] = useState<"ar" | "en" | "save" | null>(null);

  useEffect(() => {
    if (!showcaseQ.data) return;
    setArPath(showcaseQ.data.ar_path);
    setEnPath(showcaseQ.data.en_path);
    setArCaption(showcaseQ.data.ar_caption ?? "");
    setEnCaption(showcaseQ.data.en_caption ?? "");
    setPosterUrl(showcaseQ.data.poster_url ?? "");
  }, [showcaseQ.data]);

  if (adminQ.isLoading) return <Skeleton className="h-32 bg-white/5" />;
  if (!isAdmin) return null;

  async function uploadVideo(file: File, kind: "ar" | "en") {
    if (file.size > 100 * 1024 * 1024) {
      toast.error("Max 100MB");
      return;
    }
    setBusy(kind);
    try {
      const ext = file.name.split(".").pop() ?? "mp4";
      const path = `showcase/${kind}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("community").upload(path, file, {
        contentType: file.type || "video/mp4",
        upsert: false,
      });
      if (error) throw error;
      if (kind === "ar") setArPath(path); else setEnPath(path);
      toast.success("Video uploaded — click Save to publish");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function onSave() {
    setBusy("save");
    try {
      await save({
        data: {
          ar_path: arPath,
          en_path: enPath,
          ar_caption: arCaption.trim() || null,
          en_caption: enCaption.trim() || null,
          poster_url: posterUrl.trim() || null,
        },
      });
      toast.success("Showcase videos saved");
      qc.invalidateQueries({ queryKey: ["showcase-videos"] });
      qc.invalidateQueries({ queryKey: ["showcase-videos-admin"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/5 p-5">
      <div className="mb-4">
        <div className="text-sm font-semibold text-fuchsia-200 flex items-center gap-2">
          <Video className="h-4 w-4" /> Homepage showcase video ("Magic in Action")
        </div>
        <div className="text-xs text-slate-400 mt-1">
          Upload two videos — Arabic visitors see the Arabic one, everyone else sees the English one.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <VideoSlot
          label="Arabic video (العربية)"
          path={arPath}
          signedUrl={showcaseQ.data?.ar_url ?? null}
          onFile={(f) => uploadVideo(f, "ar")}
          onClear={() => setArPath(null)}
          busy={busy === "ar"}
          caption={arCaption}
          onCaption={setArCaption}
          captionPlaceholder="e.g. نسخة مصرية عن نفس الفيديو"
        />
        <VideoSlot
          label="English / foreign video"
          path={enPath}
          signedUrl={showcaseQ.data?.en_url ?? null}
          onFile={(f) => uploadVideo(f, "en")}
          onClear={() => setEnPath(null)}
          busy={busy === "en"}
          caption={enCaption}
          onCaption={setEnCaption}
          captionPlaceholder="e.g. Original English version"
        />
      </div>

      <div className="mt-4">
        <Label>Poster image URL (optional)</Label>
        <Input value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} placeholder="https://..." className="bg-white/5 border-white/10 mt-1" />
      </div>

      <div className="mt-5 flex justify-end">
        <Button
          onClick={onSave}
          disabled={busy !== null}
          className="bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold hover:opacity-90"
        >
          {busy === "save" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Save & publish
        </Button>
      </div>
    </section>
  );
}

function VideoSlot({
  label,
  path,
  signedUrl,
  onFile,
  onClear,
  busy,
  caption,
  onCaption,
  captionPlaceholder,
}: {
  label: string;
  path: string | null;
  signedUrl: string | null;
  onFile: (f: File) => void;
  onClear: () => void;
  busy: boolean;
  caption: string;
  onCaption: (v: string) => void;
  captionPlaceholder: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
      <Label className="mb-2 block">{label}</Label>
      {path && signedUrl ? (
        <video src={signedUrl} controls playsInline className="w-full rounded-lg aspect-video object-cover bg-black" preload="metadata" />
      ) : (
        <div className="w-full aspect-video rounded-lg bg-white/5 border border-dashed border-white/10 flex items-center justify-center text-xs text-slate-500">
          No video yet
        </div>
      )}
      <div className="mt-3 flex items-center gap-2">
        <Input type="file" accept="video/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} disabled={busy} className="bg-white/5 border-white/10" />
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {path ? (
          <Button size="sm" variant="ghost" className="text-red-300 hover:bg-red-500/10" onClick={onClear} title="Remove">
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <Input
        value={caption}
        onChange={(e) => onCaption(e.target.value)}
        placeholder={captionPlaceholder}
        className="bg-white/5 border-white/10 mt-3 text-xs"
      />
    </div>
  );
}