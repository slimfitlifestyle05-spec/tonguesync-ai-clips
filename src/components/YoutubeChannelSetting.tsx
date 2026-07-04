import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getYoutubeChannel, setYoutubeChannel } from "@/lib/admin.functions";
import { isAdminCheck } from "@/lib/community.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Youtube, Loader2 } from "lucide-react";

/** Admin-only card for setting the site's YouTube channel link. */
export function YoutubeChannelSetting() {
  const admin = useServerFn(isAdminCheck);
  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => admin(), retry: false });
  const load = useServerFn(getYoutubeChannel);
  const save = useServerFn(setYoutubeChannel);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["yt-channel"],
    queryFn: () => load(),
    enabled: adminQ.data?.isAdmin === true,
  });
  const [url, setUrl] = useState("");
  const [handle, setHandle] = useState("");
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  if (q.data && !hydrated) {
    setUrl(q.data.url ?? "");
    setHandle(q.data.handle ?? "");
    setHydrated(true);
  }

  if (!adminQ.data?.isAdmin) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await save({ data: { url: url.trim(), handle: handle.trim() } });
      toast.success("YouTube channel saved");
      qc.invalidateQueries({ queryKey: ["yt-channel"] });
      qc.invalidateQueries({ queryKey: ["yt-channel-public"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-red-500/25 bg-gradient-to-br from-red-600/10 via-red-500/5 to-transparent p-5">
      <div className="flex items-center gap-2 mb-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white">
          <Youtube className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold text-red-100">YouTube channel (Admin only)</div>
          <div className="text-[11px] text-slate-400">Shown as a Subscribe CTA on Viral Ideas. Gates PDF downloads once the YouTube API is connected.</div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_180px_auto] mt-4">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/@yourchannel"
          className="bg-white/5 border-white/10"
        />
        <Input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@handle (optional)"
          className="bg-white/5 border-white/10"
        />
        <Button type="submit" disabled={saving} className="bg-red-500 hover:bg-red-500/90 text-white font-semibold">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save
        </Button>
      </div>
    </form>
  );
}