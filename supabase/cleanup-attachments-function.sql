-- Alternative: Database function to mark old attachments for cleanup
-- This is simpler and doesn't require Edge Functions or pg_cron

-- Create a function that clears attachment data from old messages
CREATE OR REPLACE FUNCTION cleanup_old_message_attachments()
RETURNS TABLE (
  messages_updated integer,
  direct_messages_updated integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  msg_count integer;
  dm_count integer;
  cutoff_date timestamp;
BEGIN
  -- Calculate date 30 days ago
  cutoff_date := NOW() - INTERVAL '30 days';
  
  -- Update messages table - clear attachments array
  UPDATE messages
  SET attachments = '[]'::jsonb
  WHERE created_at < cutoff_date
    AND attachments IS NOT NULL
    AND attachments != '[]'::jsonb;
  
  GET DIAGNOSTICS msg_count = ROW_COUNT;
  
  -- Update direct_messages table - clear attachments array
  UPDATE direct_messages
  SET attachments = '[]'::jsonb
  WHERE created_at < cutoff_date
    AND attachments IS NOT NULL
    AND attachments != '[]'::jsonb;
  
  GET DIAGNOSTICS dm_count = ROW_COUNT;
  
  RETURN QUERY SELECT msg_count, dm_count;
END;
$$;

-- Grant execute permission to authenticated users (optional - you may want to restrict this)
-- GRANT EXECUTE ON FUNCTION cleanup_old_message_attachments() TO authenticated;

-- To manually run the cleanup:
-- SELECT * FROM cleanup_old_message_attachments();

-- You can also set up a simple cron job on your server to call this via API:
-- curl -X POST 'https://your-project.supabase.co/rest/v1/rpc/cleanup_old_message_attachments' \
--   -H "apikey: YOUR_ANON_KEY" \
--   -H "Authorization: Bearer YOUR_SERVICE_KEY"

COMMENT ON FUNCTION cleanup_old_message_attachments() IS 
'Removes attachment references from messages older than 30 days. 
Note: This only removes the references from the database. 
The actual files in storage will remain until manually deleted or cleaned up by a separate process.';
