import { createFileRoute, Link, ErrorComponent, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getPostBySlug } from "@/lib/blog.functions";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const postQuery = (slug: string) =>
  queryOptions({
    queryKey: ["blog", "post", slug],
    queryFn: () => getPostBySlug({ data: { slug } }),
    staleTime: 5 * 60_000,
  });

export const Route = createFileRoute("/blog/$slug")({
  head: ({ loaderData }) => {
    const post = loaderData as Awaited<ReturnType<typeof getPostBySlug>> | undefined;
    if (!post) return { meta: [{ title: "Article not found — TongueSync" }] };
    return {
      meta: [
        { title: `${post.title} — TongueSync Blog` },
        { name: "description", content: post.excerpt },
        { property: "og:title", content: post.title },
        { property: "og:description", content: post.excerpt },
        { property: "og:type", content: "article" },
        { property: "article:published_time", content: post.published_at },
        { property: "article:author", content: post.author_name },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  loader: async ({ context, params }) => {
    const post = await context.queryClient.ensureQueryData(postQuery(params.slug));
    if (!post) throw notFound();
    return post;
  },
  component: BlogPostPage,
  errorComponent: ({ error }) => <ErrorComponent error={error} />,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-center text-white">
      <div>
        <h1 className="text-2xl font-semibold">Article not found</h1>
        <p className="mt-2 text-slate-400">This post may have been removed.</p>
        <Link to="/blog"><Button className="mt-6">Back to the blog</Button></Link>
      </div>
    </div>
  ),
});

function BlogPostPage() {
  const { slug } = Route.useParams();
  const { data: post } = useSuspenseQuery(postQuery(slug));
  if (!post) return null;
  const date = new Date(post.published_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2"><Logo /></Link>
          <Link to="/blog">
            <Button variant="ghost" className="text-white hover:bg-white/10">
              <ArrowLeft className="mr-2 h-4 w-4" /> All articles
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-300">TongueSync Journal</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{post.title}</h1>
          <p className="mt-5 text-lg text-slate-300">{post.excerpt}</p>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <span>{post.author_name}</span>
            <span>&middot;</span>
            <span>{date}</span>
            <span>&middot;</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{post.reading_minutes} min read</span>
          </div>
        </div>

        <article className="prose prose-invert prose-lg max-w-none prose-headings:tracking-tight prose-h1:hidden prose-h2:mt-12 prose-h2:text-2xl prose-p:text-slate-300 prose-strong:text-white prose-a:text-fuchsia-300 hover:prose-a:text-fuchsia-200 prose-li:text-slate-300 prose-blockquote:border-fuchsia-400 prose-blockquote:text-slate-200">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
        </article>

        <div className="mt-16 rounded-xl border border-white/10 bg-gradient-to-br from-fuchsia-500/10 to-amber-500/10 p-8 text-center">
          <h3 className="text-xl font-bold">Try TongueSync AI free</h3>
          <p className="mt-2 text-slate-300">Turn one video into vertical shorts dubbed for any market — in minutes.</p>
          <Link to="/auth">
            <Button className="mt-5 bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold hover:opacity-90">
              Get started
            </Button>
          </Link>
        </div>
      </main>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-slate-500">
        &copy; {new Date().getFullYear()} TongueSync AI
      </footer>
    </div>
  );
}