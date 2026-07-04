DROP FUNCTION IF EXISTS public.consume_ai_coach_credit(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.consume_ai_coach_credit()
RETURNS TABLE(allowed BOOLEAN, used INTEGER, credits_left INTEGER, daily_limit INTEGER, tier TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  today DATE := (now() AT TIME ZONE 'utc')::date;
  user_tier TEXT;
  _limit INTEGER;
  new_count INTEGER;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(p.tier::TEXT, 'free') INTO user_tier
    FROM public.profiles p WHERE p.id = uid;
  user_tier := COALESCE(user_tier, 'free');
  _limit := CASE WHEN user_tier = 'pro' THEN 50 ELSE 10 END;

  INSERT INTO public.ai_coach_usage (user_id, usage_date, count, updated_at)
  VALUES (uid, today, 1, now())
  ON CONFLICT (user_id, usage_date) DO UPDATE
    SET count = public.ai_coach_usage.count + 1,
        updated_at = now()
    WHERE public.ai_coach_usage.count < _limit
  RETURNING public.ai_coach_usage.count INTO new_count;

  IF new_count IS NULL THEN
    SELECT c.count INTO new_count FROM public.ai_coach_usage c
      WHERE c.user_id = uid AND c.usage_date = today;
    RETURN QUERY SELECT FALSE, COALESCE(new_count, _limit), 0, _limit, user_tier;
  ELSE
    RETURN QUERY SELECT TRUE, new_count, GREATEST(_limit - new_count, 0), _limit, user_tier;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_coach_credit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_ai_coach_credit() TO authenticated;