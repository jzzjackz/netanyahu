# Commz Features Documentation

## Recent Updates

### File Uploads & Attachments
- **Upload files** in both server channels and direct messages
- Click the `+` button in the message input to select files
- Multiple file selection supported
- Files are stored in Supabase Storage `attachments` bucket
- Attachment metadata saved in message.attachments jsonb field

### Image Embeds
- Images automatically display inline in messages
- Max dimensions: 320px height, 448px width (max-h-80, max-w-md)
- Click images to open in new tab
- Non-image files show as download links with file icon

### Voice Channels
- Create voice channels in servers (server owner only)
- Voice channels appear in separate section with 🔊 icon
- Click a voice channel to join
- Voice call UI shows:
  - Real-time participant list
  - Mute/unmute button
  - Deafen/undeafen button
  - Leave call button
  - Connection status indicator

### Private Calls (DM Voice/Video)
- Start voice or video calls in direct messages
- Call buttons in DM header (phone and video icons)
- Full-screen call interface with:
  - Large video/avatar display
  - Self video preview (when video enabled)
  - Mute/unmute control
  - Video on/off toggle
  - Deafen/undeafen control
  - End call button
  - Connection status

### Message Features
- **Markdown support** with react-markdown and remark-gfm
- **Reply to messages** - hover over message and click Reply
- **Delete messages** - delete your own messages (hover to see button)
- **Typing indicators** - shows specific usernames typing
- **Link embeds** - automatic embeds for URLs and invite links
- **Real-time updates** - messages, members, and DMs auto-refresh

### Server Features
- **Server creation** with custom names and icons
- **Channel management** (text and voice)
- **Invite system** - generate and share invite links
- **Member management** - view all server members
- **Kick/ban members** (server owner only)
- **Server ownership** - only owners can create channels and manage members

### Friend System
- **Friend requests** - send and receive friend requests
- **Direct messages** - chat privately with friends
- **Online status** - see friend status
- **DM list** - auto-updates when new conversations start

### AllInOne Vidz (Video Platform)
- YouTube-like video platform at `/vidz`
- Shared authentication with Commz
- Features:
  - Direct video file uploads to Supabase Storage
  - Like/dislike system
  - Comments with real-time updates
  - Subscriptions to channels
  - View counts
  - Video thumbnails
  - Search and browse

## Database Setup

Run these SQL migrations in order in Supabase SQL Editor:

1. `clean-migration.sql` - Core tables (servers, channels, messages, etc.)
2. `enable-rls-simple.sql` - Row Level Security policies
3. `enable-realtime.sql` - Enable realtime subscriptions
4. `add-bans-table.sql` - Server bans functionality
5. `add-message-features.sql` - Reply and delete features
6. `add-attachments.sql` - File upload support
7. `create-storage-buckets.sql` - Storage buckets for videos
8. `add-video-platform.sql` - AllInOne Vidz tables
9. `add-voice-channels.sql` - Voice channel realtime support

## Storage Buckets

The app uses these Supabase Storage buckets:
- `attachments` - Message attachments (images, files)
- `videos` - Video files for AllInOne Vidz
- `thumbnails` - Video thumbnails

## Technology Stack

- **Framework**: Next.js 16 with App Router
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **Real-time**: Supabase Realtime (WebSocket)
- **Styling**: Tailwind CSS
- **Markdown**: react-markdown + remark-gfm

## Voice/Video Implementation Notes

The current voice and video call features provide:
- ✅ Full UI/UX for calls
- ✅ Real-time presence tracking
- ✅ Call state management
- ✅ Mute/deafen/video controls
- ⚠️ **WebRTC not implemented** - actual audio/video streaming requires integration with:
  - Daily.co
  - Agora
  - Twilio Video
  - Custom WebRTC implementation

The foundation is complete and ready for WebRTC integration.

## File Upload Limits

Default Supabase limits:
- Max file size: 50MB (configurable in Supabase dashboard)
- Storage quota: 1GB free tier (upgradeable)

## Security Features

- Row Level Security (RLS) on all tables
- Authentication required for all operations
- Server owners control member management
- Users can only delete their own messages
- File uploads scoped to authenticated users
- Storage policies prevent unauthorized access

## Future Enhancements

Potential additions:
- WebRTC integration for actual voice/video
- Screen sharing in calls
- Message editing
- Message reactions/emojis
- Server roles and permissions
- Channel categories
- Voice channel user limit
- Push notifications
- Mobile app (React Native)
