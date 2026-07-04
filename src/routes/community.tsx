import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listCommunityIdeas,
  toggleCommunityVote,
  getMyVotes,
  type CommunityIdea,
} from "@/lib/community.functions";
import { getYoutubeChannel } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Heart,
  FileText,
  ArrowLeft,
  Search,
  ArrowUpDown,
  Lock,
  PlayCircle,
  X,
  Youtube,
  ThumbsUp,
  MessageSquare,
  Info,
} from "lucide-react";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Viral Ideas — Trending short video ideas | TongueSync AI" },
      {
        name: "description",
        content:
          "Viral Ideas — trending short-form video ideas from TongueSync, with step-by-step PDF playbooks you can download and run today.",
      },
      { property: "og:title", content: "TongueSync Viral Ideas — Trending short ideas" },
      {
        property: "og:description",
        content: "Fresh viral short video ideas + PDF playbooks curated by the TongueSync team.",
      },
    ],
  }),
  component: CommunityPage,
});

function CommunityPage() {
  const qc = useQueryClient();
  const list = useServerFn(listCommunityIdeas);
  const votes = useServerFn(getMyVotes);

  const ideasQ = useQuery({ queryKey: ["community-ideas"], queryFn: () => list() });
  const votesQ = useQuery({ queryKey: ["community-my-votes"], queryFn: () => votes(), retry: false });
  const ytChannel = useServerFn(getYoutubeChannel);
  const channelQ = useQuery({ queryKey: ["yt-channel-public"], queryFn: () => ytChannel() });
  const channelUrl = channelQ.data?.url ?? "";
  const channelHandle = channelQ.data?.handle ?? "";

  const myVotes = new Set(votesQ.data ?? []);

  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(Boolean(session)));
    return () => sub.subscription.unsubscribe();
  }, []);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "likes" | "title">("newest");

  const filtered = useMemo(() => {
    const items = ideasQ.data ?? [];
    const q = query.trim().toLowerCase();
    const matched = q
      ? items.filter(
          (i) =>
            i.title.toLowerCase().includes(q) ||
            i.description.toLowerCase().includes(q) ||
            i.category.toLowerCase().includes(q) ||
            (i.tags ?? []).some((t) => t.toLowerCase().includes(q)),
        )
      : items;
    const sorted = [...matched];
    if (sort === "likes") sorted.sort((a, b) => b.votes - a.votes);
    else if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title));
    else sorted.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return sorted;
  }, [ideasQ.data, query, sort]);

  const total = (ideasQ.data ?? []).length;
  const shown = filtered.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/"><Logo /></Link>
        <nav className="flex items-center gap-2">
          <LangToggle />
          <Link to="/"><Button variant="ghost" className="text-white hover:bg-white/10"><ArrowLeft className="h-4 w-4 mr-1" /> Home</Button></Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-4 pb-10">
        {channelUrl ? (
          <a
            href={channelUrl}
            target="_blank"
            rel="noreferrer"
            className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-red-500/30 bg-gradient-to-r from-red-600/15 via-red-500/10 to-transparent px-4 py-3 transition hover:border-red-400/60"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white">
                <Youtube className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-white">Subscribe on YouTube{channelHandle ? ` · ${channelHandle}` : ""}</div>
                <div className="text-[11px] text-slate-300">Soon: subscribe + like + watch ≥ 50% to unlock every PDF playbook.</div>
              </div>
            </div>
            <Button size="sm" className="bg-red-600 text-white hover:bg-red-500">Subscribe</Button>
          </a>
        ) : null}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ideas"
              className="pl-9 pr-9 bg-white/5 border-white/10 h-11"
            />
            {query ? (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="md:w-56 h-11 bg-white/5 border-white/10">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-slate-400" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Sort: Newest</SelectItem>
              <SelectItem value="likes">Sort: Most liked</SelectItem>
              <SelectItem value="title">Sort: Title A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!ideasQ.isLoading && total > 0 ? (
          <div className="mt-4 text-center text-xs text-slate-400">
            {shown} of {total} PDFs{query ? ` match "${query}"` : ""}
          </div>
        ) : null}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        {ideasQ.isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 bg-white/5" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-slate-300">
            {total === 0
              ? "No ideas yet. Check back soon — we drop new ones every week."
              : "No ideas match your search."}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((idea, i) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                index={i}
                voted={myVotes.has(idea.id)}
                signedIn={signedIn}
                channelUrl={channelUrl}
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
  index,
  voted,
  signedIn,
  channelUrl,
  onChange,
}: {
  idea: CommunityIdea;
  index: number;
  voted: boolean;
  signedIn: boolean;
  channelUrl: string;
  onChange: () => void;
}) {
  const vote = useServerFn(toggleCommunityVote);

  const voteM = useMutation({
    mutationFn: () => vote({ data: { ideaId: idea.id } }),
    onSuccess: () => onChange(),
    onError: (e: any) => toast.error(e?.message ?? "Sign in to vote"),
  });

  const vol = String(index + 1).padStart(2, "0");
  const videoUrl = idea.youtube_video_url && /^https?:\/\//i.test(idea.youtube_video_url)
    ? idea.youtube_video_url
    : (idea.cta && /^https?:\/\//i.test(idea.cta) ? idea.cta : null);

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur transition hover:border-fuchsia-400/40">
      <div className="relative">
        {idea.thumbnail_signed_url ? (
          <img src={idea.thumbnail_signed_url} alt={idea.title} className="h-44 w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-fuchsia-500/20 to-amber-400/20">
            <FileText className="h-10 w-10 text-white/50" />
          </div>
        )}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white shadow">
          <FileText className="h-3 w-3" /> VOL.{vol}
        </span>
        <button
          onClick={() => voteM.mutate()}
          disabled={voteM.isPending}
          aria-label="Like"
          className={
            "absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs backdrop-blur transition " +
            (voted
              ? "bg-fuchsia-500/30 text-fuchsia-100 border border-fuchsia-300/40"
              : "bg-black/50 text-white border border-white/10 hover:bg-black/70")
          }
        >
          <Heart className={"h-3.5 w-3.5 " + (voted ? "fill-fuchsia-300 text-fuchsia-300" : "")} />
          {idea.votes}
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="text-base font-semibold leading-snug text-white line-clamp-2">{idea.title}</h3>
        {idea.youtube_video_url ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 py-2 text-[11px] text-slate-300">
            <div className="flex items-center gap-1.5 text-red-300 font-medium">
              <Info className="h-3 w-3" /> To unlock the PDF:
            </div>
            <ul className="mt-1 grid grid-cols-3 gap-1 text-slate-400">
              <li className="flex items-center gap-1"><Youtube className="h-3 w-3 text-red-400" /> Subscribe</li>
              <li className="flex items-center gap-1"><ThumbsUp className="h-3 w-3 text-red-400" /> Like</li>
              <li className="flex items-center gap-1"><MessageSquare className="h-3 w-3 text-red-400" /> Comment</li>
            </ul>
          </div>
        ) : null}
        <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
          {videoUrl ? (
            <a href={videoUrl} target="_blank" rel="noreferrer" className="contents">
              <Button variant="outline" className="w-full border-red-500/30 bg-red-500/10 text-white hover:bg-red-500/20">
                <Youtube className="h-4 w-4 mr-1 text-red-400" /> Watch on YouTube
              </Button>
            </a>
          ) : channelUrl ? (
            <a href={channelUrl} target="_blank" rel="noreferrer" className="contents">
              <Button variant="outline" className="w-full border-white/10 bg-white/5 text-white hover:bg-white/10">
                <Youtube className="h-4 w-4 mr-1 text-red-400" /> Subscribe
              </Button>
            </a>
          ) : (
            <Button variant="outline" disabled className="w-full border-white/10 bg-white/5 text-white/60">
              <PlayCircle className="h-4 w-4 mr-1" /> Watch Video
            </Button>
          )}
          {idea.pdf_signed_url ? (
            signedIn ? (
              <a href={idea.pdf_signed_url} target="_blank" rel="noreferrer" className="contents">
                <Button className="w-full bg-red-600 text-white hover:bg-red-500">
                  <FileText className="h-4 w-4 mr-1" /> Download PDF
                </Button>
              </a>
            ) : (
              <Link to="/auth" className="contents">
                <Button className="w-full bg-red-600 text-white hover:bg-red-500">
                  <Lock className="h-4 w-4 mr-1" /> Sign in to download
                </Button>
              </Link>
            )
          ) : (
            <Button disabled className="w-full bg-red-600/40 text-white/70">
              <FileText className="h-4 w-4 mr-1" /> No PDF yet
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

