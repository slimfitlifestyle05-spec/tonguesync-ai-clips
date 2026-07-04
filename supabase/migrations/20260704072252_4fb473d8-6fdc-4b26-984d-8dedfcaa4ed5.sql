
CREATE POLICY "Community files are publicly readable"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'community');

CREATE POLICY "Admins upload community files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'community' AND private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update community files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'community' AND private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete community files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'community' AND private.has_role(auth.uid(), 'admin'::app_role));
