CREATE TABLE public.ai_coach_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_coach_usage TO authenticated;
GRANT ALL ON public.ai_coach_usage TO service_role;
ALTER TABLE public.ai_coach_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own AI coach usage" ON public.ai_coach_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own AI coach usage" ON public.ai_coach_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own AI coach usage" ON public.ai_coach_usage FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);