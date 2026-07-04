ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS channel_country TEXT;