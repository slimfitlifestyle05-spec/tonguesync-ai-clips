import { createFileRoute, Link, ErrorComponent, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listPublishedPosts } from "@/lib/blog.functions";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Clock } from "lucide-react";

const postsQuery = queryOptions({
  queryKey: ["blog", "list"],
  queryFn: () => listPublishedPosts(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "The TongueSync Blog — AI dubbing, voice cloning, and video localization" },
      {
        name: "description",
        content:
          "Practical, opinionated articles on AI dubbing, voice cloning, lip-sync, and localizing video for a global audience.",
      },
      { property: "og:title", content: "The TongueSync Blog" },
      { property: "og:description", content: "Practical articles on AI dubbing and video localization." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://tonguesyncai.com/blog" },
    ],
    links: [{ rel: "canonical", href: "https://tonguesyncai.com/blog" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(postsQuery),
  component: BlogIndex,
  pendingComponent: BlogSkeleton,
  pendingMs: 0,
  errorComponent: ({ error }) => <ErrorComponent error={error} />,
  notFoundComponent: () => <div className="p-10 text-center text-white">No posts yet.</div>,
});

function BlogSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <Skeleton className="h-4 w-40 bg-white/10" />
        <Skeleton className="mt-4 h-12 w-3/4 bg-white/10" />
        <Skeleton className="mt-3 h-5 w-1/2 bg-white/10" />
        <Skeleton className="mt-12 h-56 w-full rounded-2xl bg-white/5" />
        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-6">
              <Skeleton className="h-6 w-3/4 bg-white/10" />
              <Skeleton className="mt-3 h-4 w-full bg-white/10" />
              <Skeleton className="mt-2 h-4 w-5/6 bg-white/10" />
              <Skeleton className="mt-6 h-4 w-1/3 bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BlogIndex() {
  const { data: posts } = useSuspenseQuery(postsQuery);
  const [featured, ...rest] = posts;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/"><Button variant="ghost" className="text-white hover:bg-white/10">Home</Button></Link>
            <Link to="/auth"><Button className="bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold hover:opacity-90">Get started</Button></Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-12 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-fuchsia-300">The TongueSync Journal</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Practical writing on AI dubbing, voice cloning, and video localization.
          </h1>
          <p className="mt-4 text-lg text-slate-300">
            No fluff. No listicles. Just what actually works, from the people building the pipeline.
          </p>
        </div>

        {!featured ? (
          <p className="text-slate-400">No articles published yet.</p>
        ) : (
          <>
            <FeaturedCard post={featured} />
            <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {rest.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-slate-500">
        &copy; {new Date().getFullYear()} TongueSync AI
      </footer>
    </div>
  );
}

function FeaturedCard({ post }: { post: Awaited<ReturnType<typeof listPublishedPosts>>[number] }) {
  return (
    <Link
      to="/blog/$slug"
      params={{ slug: post.slug }}
      className="group block overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-500/10 via-slate-900 to-amber-500/10 p-8 transition-colors hover:border-fuchsia-400/40 md:p-12"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-fuchsia-300">Featured</p>
      <h2 className="text-2xl font-bold leading-tight tracking-tight sm:text-4xl">{post.title}</h2>
      <p className="mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">{post.excerpt}</p>
      <div className="mt-6 flex items-center gap-4 text-sm text-slate-400">
        <span>{post.author_name}</span>
        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{post.reading_minutes} min read</span>
        <span className="inline-flex items-center gap-1 text-fuchsia-300 transition-transform group-hover:translate-x-1">
          Read article <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

function PostCard({ post }: { post: Awaited<ReturnType<typeof listPublishedPosts>>[number] }) {
  return (
    <Link
      to="/blog/$slug"
      params={{ slug: post.slug }}
      className="group flex flex-col rounded-xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-fuchsia-400/40 hover:bg-white/[0.07]"
    >
      <h3 className="text-xl font-semibold leading-snug tracking-tight">{post.title}</h3>
      <p className="mt-3 flex-1 text-sm text-slate-400">{post.excerpt}</p>
      <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{post.reading_minutes} min read</span>
        <span className="inline-flex items-center gap-1 text-fuchsia-300 transition-transform group-hover:translate-x-1">
          Read <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}