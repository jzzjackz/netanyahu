# Setup Guide - New Features

## Quick Start

### 1. Run SQL Migrations

Open Supabase SQL Editor and run these files in order:

```sql
-- If not already run:
-- 1. clean-migration.sql
-- 2. enable-rls-simple.sql
-- 3. enable-realtime.sql
-- 4. add-bans-table.sql
-- 5. add-message-features.sql
-- 6. create-storage-buckets.sql
-- 7. add-video-platform.sql

-- NEW: Run these now
8. add-attachments.sql
9. add-voice-channels.sql
```

### 2. Verify Storage Buckets

Go to Supabase Dashboard → Storage and verify these buckets exist:
- ✅ `attachments` (public)
- ✅ `videos` (public)
- ✅ `thumbnails` (public)

### 3. Test Features

#### File Uploads
1. Go to any channel or DM
2. Click the `+` button in message input
3. Select one or more files
4. Click Send
5. Images should display inline, other files as download links

#### Voice Channels
1. As server owner, click "Create Channel"
2. Select "🔊 Voice" type
3. Enter channel name and create
4. Click the voice channel to join
5. See the call UI at bottom of screen
6. Test mute/deafen/leave controls

#### Private Calls
1. Open a direct message with a friend
2. Click phone icon (voice) or video icon (video call)
3. Full-screen call interface appears
4. Test mute/video/deafen/end call controls

## Troubleshooting

### Files won't upload
- Check Supabase Storage quota (Dashboard → Settings → Usage)
- Verify `attachments` bucket exists and is public
- Check browser console for errors
- Ensure user is authenticated

### Voice channels don't show
- Verify `add-voice-channels.sql` was run
- Check that channels table has `type` column
- Refresh the page

### Images don't display
- Check that files uploaded successfully to Storage
- Verify bucket policies allow public read access
- Check browser console for CORS errors

### Call UI doesn't appear
- Verify you clicked a voice channel or call button
- Check browser console for errors
- Ensure Supabase Realtime is enabled

## Configuration

### File Upload Limits

Edit in Supabase Dashboard → Storage → Settings:
- Max file size (default: 50MB)
- Allowed MIME types
- Storage quota

### Storage Policies

Current policies in `add-attachments.sql`:
- Anyone can view attachments (public read)
- Authenticated users can upload
- Users can delete their own files

To modify, edit the SQL file and re-run.

## Development

### Local Testing

```bash
cd discord-clone
npm install
npm run dev
```

Open http://localhost:3000

### Environment Variables

Ensure `.env.local` has:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## WebRTC Integration (Future)

To add actual audio/video streaming:

### Option 1: Daily.co
```bash
npm install @daily-co/daily-js
```

### Option 2: Agora
```bash
npm install agora-rtc-sdk-ng
```

### Option 3: Twilio
```bash
npm install twilio-video
```

Then update `VoiceCall.tsx` and `PrivateCall.tsx` to initialize WebRTC connections.

## Production Deployment

### Vercel Deployment

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Environment Variables in Vercel

Add these in Vercel Dashboard → Settings → Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Support

For issues:
1. Check browser console for errors
2. Verify all SQL migrations ran successfully
3. Check Supabase logs (Dashboard → Logs)
4. Ensure RLS policies are correct
