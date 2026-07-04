
CREATE TABLE public.community_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  tags text[] NOT NULL DEFAULT '{}',
  hook text,
  cta text,
  thumbnail_url text,
  pdf_url text,
  is_published boolean NOT NULL DEFAULT true,
  votes integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.community_ideas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_ideas TO authenticated;
GRANT ALL ON public.community_ideas TO service_role;

ALTER TABLE public.community_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published ideas are public" ON public.community_ideas
  FOR SELECT TO anon, authenticated
  USING (is_published = true OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert ideas" ON public.community_ideas
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update ideas" ON public.community_ideas
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete ideas" ON public.community_ideas
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER community_ideas_set_updated_at
  BEFORE UPDATE ON public.community_ideas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX community_ideas_published_votes_idx
  ON public.community_ideas (is_published, votes DESC, created_at DESC);


CREATE TABLE public.community_idea_votes (
  idea_id uuid NOT NULL REFERENCES public.community_ideas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (idea_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.community_idea_votes TO authenticated;
GRANT ALL ON public.community_idea_votes TO service_role;

ALTER TABLE public.community_idea_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own votes" ON public.community_idea_votes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users add own vote" ON public.community_idea_votes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users remove own vote" ON public.community_idea_votes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


CREATE OR REPLACE FUNCTION public.sync_community_votes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_ideas SET votes = votes + 1 WHERE id = NEW.idea_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_ideas SET votes = GREATEST(votes - 1, 0) WHERE id = OLD.idea_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER community_idea_votes_sync
  AFTER INSERT OR DELETE ON public.community_idea_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_community_votes();
