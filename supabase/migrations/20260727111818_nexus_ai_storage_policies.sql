/*
# Storage policies for the `documents` bucket

## Overview
The `documents` bucket is a private Supabase Storage bucket used by Nexus AI
to hold user-uploaded PDFs. Each authenticated user may read, write, update,
and delete only objects under their own user-id prefix.

## Security
- SELECT/INSERT/UPDATE/DELETE scoped to `auth.uid()` matched against the first
  path segment of the object name (`user_id/filename`).
- `TO authenticated` — the app has a sign-in screen.
*/

DROP POLICY IF EXISTS "read_own_documents" ON storage.objects;
CREATE POLICY "read_own_documents" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "insert_own_documents" ON storage.objects;
CREATE POLICY "insert_own_documents" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "update_own_documents" ON storage.objects;
CREATE POLICY "update_own_documents" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "delete_own_documents" ON storage.objects;
CREATE POLICY "delete_own_documents" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
