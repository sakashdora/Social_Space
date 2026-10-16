-- Apply in the Supabase SQL editor after Prisma migrations. Disable public
-- Realtime channels in project settings. This grants receive-only access to a
-- user's own notification channel; clients cannot publish trusted events.
CREATE OR REPLACE FUNCTION public.can_receive_veil_realtime()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."User" u
    WHERE u.id = auth.uid()::text AND NOT u."isBanned"
      AND u."tokenVersion"::text = auth.jwt()->>'token_version'
      AND auth.jwt()->>'scope' = 'veil-realtime'
  );
$$;
REVOKE ALL ON FUNCTION public.can_receive_veil_realtime() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_receive_veil_realtime() TO authenticated;
DROP POLICY IF EXISTS veil_receive_own_chat ON realtime.messages;
CREATE POLICY veil_receive_own_chat ON realtime.messages FOR SELECT TO authenticated
USING (extension = 'broadcast' AND realtime.topic() = 'user:' || auth.uid()::text AND public.can_receive_veil_realtime());
