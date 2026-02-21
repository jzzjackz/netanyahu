-- Setup automatic cleanup of old attachments
-- This creates a cron job that runs daily to delete attachments older than 30 days

-- Enable the pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to call the Edge Function
CREATE OR REPLACE FUNCTION cleanup_old_attachments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  function_url text;
  service_key text;
BEGIN
  -- Get the Supabase URL and service key from environment
  -- Note: You'll need to set these in your Supabase project settings
  function_url := current_setting('app.supabase_url', true) || '/functions/v1/cleanup-old-attachments';
  service_key := current_setting('app.supabase_service_key', true);
  
  -- Call the Edge Function using http extension
  PERFORM
    net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || service_key,
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
END;
$$;

-- Schedule the cleanup to run daily at 2 AM UTC
SELECT cron.schedule(
  'cleanup-old-attachments',
  '0 2 * * *', -- Every day at 2 AM
  $$SELECT cleanup_old_attachments();$$
);

-- To manually trigger the cleanup, you can run:
-- SELECT cleanup_old_attachments();

-- To check scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule the job:
-- SELECT cron.unschedule('cleanup-old-attachments');
