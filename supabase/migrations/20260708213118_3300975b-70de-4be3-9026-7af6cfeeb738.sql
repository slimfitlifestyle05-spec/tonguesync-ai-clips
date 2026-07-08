-- Trigger functions must not be callable via the Data API
REVOKE EXECUTE ON FUNCTION public.grant_admin_on_confirm() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_community_votes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- consume_ai_coach_credit is user-facing; keep it callable by signed-in users only
REVOKE EXECUTE ON FUNCTION public.consume_ai_coach_credit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_coach_credit() TO authenticated;