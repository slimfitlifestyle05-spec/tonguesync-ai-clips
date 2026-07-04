
CREATE TABLE public.ai_coach_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  niche TEXT,
  topics TEXT,
  title TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_coach_conversations TO authenticated;
GRANT ALL ON public.ai_coach_conversations TO service_role;

ALTER TABLE public.ai_coach_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own AI Coach conversations"
  ON public.ai_coach_conversations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX ai_coach_conversations_user_updated_idx
  ON public.ai_coach_conversations (user_id, updated_at DESC);

CREATE TRIGGER ai_coach_conversations_set_updated_at
  BEFORE UPDATE ON public.ai_coach_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
