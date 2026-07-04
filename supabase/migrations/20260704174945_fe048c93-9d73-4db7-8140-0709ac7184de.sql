CREATE OR REPLACE FUNCTION public.consume_ai_coach_credit(_user_id UUID, _daily_limit INTEGER)
RETURNS TABLE(allowed BOOLEAN, used INTEGER, credits_left INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today DATE := (now() AT TIME ZONE 'utc')::date;
  new_count INTEGER;
BEGIN
  INSERT INTO public.ai_coach_usage (user_id, usage_date, count, updated_at)
  VALUES (_user_id, today, 1, now())
  ON CONFLICT (user_id, usage_date) DO UPDATE
    SET count = public.ai_coach_usage.count + 1,
        updated_at = now()
    WHERE public.ai_coach_usage.count < _daily_limit
  RETURNING public.ai_coach_usage.count INTO new_count;

  IF new_count IS NULL THEN
    SELECT c.count INTO new_count FROM public.ai_coach_usage c
      WHERE c.user_id = _user_id AND c.usage_date = today;
    RETURN QUERY SELECT FALSE, new_count, 0;
  ELSE
    RETURN QUERY SELECT TRUE, new_count, GREATEST(_daily_limit - new_count, 0);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_coach_credit(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_ai_coach_credit(UUID, INTEGER) TO authenticated, service_role;