# Attachment Cleanup System

This system automatically removes message attachments older than 30 days to save storage space.

## Setup Options

### Option 1: Simple Database Function (Recommended)

This is the easiest option. It removes attachment references from the database but leaves files in storage.

1. Run the SQL file in Supabase SQL Editor:
   ```sql
   -- Run: cleanup-attachments-function.sql
   ```

2. Manually trigger cleanup anytime:
   ```sql
   SELECT * FROM cleanup_old_message_attachments();
   ```

3. (Optional) Set up a cron job on your server to call this daily:
   ```bash
   # Add to your crontab (crontab -e)
   0 2 * * * curl -X POST 'https://your-project.supabase.co/rest/v1/rpc/cleanup_old_message_attachments' \
     -H "apikey: YOUR_ANON_KEY" \
     -H "Authorization: Bearer YOUR_SERVICE_KEY"
   ```

### Option 2: Edge Function with Storage Deletion (Advanced)

This option actually deletes files from Supabase Storage.

1. Deploy the Edge Function:
   ```bash
   cd discord-clone
   supabase functions deploy cleanup-old-attachments
   ```

2. Set up environment variables in Supabase Dashboard:
   - Go to Project Settings → Edge Functions
   - Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

3. Manually trigger:
   ```bash
   curl -X POST 'https://your-project.supabase.co/functions/v1/cleanup-old-attachments' \
     -H "Authorization: Bearer YOUR_SERVICE_KEY"
   ```

4. (Optional) Set up pg_cron:
   ```sql
   -- Run: setup-attachment-cleanup.sql
   ```

### Option 3: Supabase Storage Lifecycle Rules

The simplest option if you just want files deleted automatically:

1. Go to Supabase Dashboard → Storage → attachments bucket
2. Click on "Policies" or "Settings"
3. Look for "Lifecycle rules" or "Object lifecycle"
4. Add a rule to delete objects older than 30 days

Note: This only deletes files, not database references. Messages will still show attachment metadata.

## Recommended Approach

Use **Option 1** (Database Function) + **Option 3** (Storage Lifecycle):
- Database function removes attachment references from messages
- Storage lifecycle automatically deletes old files
- No need for Edge Functions or complex cron jobs

## Testing

To test the cleanup:

1. Create a test message with an attachment
2. Manually update its `created_at` to 31 days ago:
   ```sql
   UPDATE messages 
   SET created_at = NOW() - INTERVAL '31 days'
   WHERE id = 'your-message-id';
   ```
3. Run the cleanup function:
   ```sql
   SELECT * FROM cleanup_old_message_attachments();
   ```
4. Verify the attachment is removed from the message

## Notes

- Attachments are stored in the `attachments` Supabase Storage bucket
- The cleanup only affects messages older than 30 days
- Users will see "Attachment expired" or empty attachment arrays for old messages
- Consider notifying users about the 30-day retention policy in your Terms of Service
