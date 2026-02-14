# Quick Reference Card

## 📎 File Uploads

| Action | How |
|--------|-----|
| Upload files | Click `+` button in message input |
| Select multiple | Hold Ctrl/Cmd while selecting |
| Remove file | Click ✕ on file preview |
| View image | Click image to open in new tab |
| Download file | Click file link |

## 🔊 Voice Channels

| Action | How |
|--------|-----|
| Create voice channel | Click "Create Channel" → Select 🔊 Voice |
| Join voice channel | Click voice channel in sidebar |
| Mute microphone | Click microphone button in call UI |
| Deafen audio | Click headphone button |
| Leave call | Click "Leave Call" button |

## 📞 Private Calls

| Action | How |
|--------|-----|
| Start voice call | Click phone icon in DM header |
| Start video call | Click video icon in DM header |
| Toggle video | Click video button during call |
| Mute | Click microphone button |
| End call | Click red phone button |

## 💬 Messages

| Action | How |
|--------|-----|
| Reply to message | Hover → Click "Reply" |
| Delete message | Hover → Click "Delete" (own messages only) |
| Send with files | Attach files + type message + Send |
| Send only files | Attach files + Send (no text needed) |

## 🎮 Server Management

| Action | Who Can Do It |
|--------|---------------|
| Create channels | Server owner only |
| Kick members | Server owner only |
| Ban members | Server owner only |
| Generate invite | Anyone in server |
| Join via invite | Anyone with link |

## 🔗 Invite System

| Action | How |
|--------|-----|
| Generate invite | Click 🔗 in server header |
| Copy invite link | Click "Copy again" or auto-copied |
| Join server | Visit invite link → Click "Join Server" |

## 👥 Friends & DMs

| Action | How |
|--------|-----|
| Send friend request | Home → Friends → Enter username |
| Accept request | Click "Accept" on pending request |
| Start DM | Click friend in DM list |
| Call friend | Open DM → Click phone/video icon |

## 🎥 AllInOne Vidz

| Action | How |
|--------|-----|
| Access Vidz | Click "AllInOne Vidz" in sidebar |
| Upload video | Click "Upload Video" |
| Watch video | Click video thumbnail |
| Like/dislike | Click thumbs up/down |
| Comment | Type in comment box → Submit |
| Subscribe | Click "Subscribe" on channel |

## 🔐 Authentication

| Action | How |
|--------|-----|
| Register | Go to /register |
| Login | Go to /login |
| Logout | Click profile → Logout |

## ⚙️ SQL Migrations Order

Run in Supabase SQL Editor:

1. `clean-migration.sql`
2. `enable-rls-simple.sql`
3. `enable-realtime.sql`
4. `add-bans-table.sql`
5. `add-message-features.sql`
6. `create-storage-buckets.sql`
7. `add-video-platform.sql`
8. `add-attachments.sql` ⭐ NEW
9. `add-voice-channels.sql` ⭐ NEW

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Files won't upload | Check Storage quota in Supabase |
| Images don't show | Verify `attachments` bucket is public |
| Voice channel missing | Run `add-voice-channels.sql` |
| Can't create channel | Must be server owner |
| Call UI doesn't appear | Check browser console for errors |

## 📊 Storage Buckets

| Bucket | Purpose | Public |
|--------|---------|--------|
| `attachments` | Message files | ✅ Yes |
| `videos` | Video files | ✅ Yes |
| `thumbnails` | Video thumbnails | ✅ Yes |

## 🎯 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Enter | Send message |
| Esc | Close modal/cancel |
| Ctrl/Cmd + V | Paste (including images) |

## 📱 Supported File Types

| Type | Display |
|------|---------|
| Images (jpg, png, gif, webp) | Inline embed |
| Videos (mp4, webm) | Download link |
| Documents (pdf, docx) | Download link |
| Archives (zip, rar) | Download link |
| All others | Download link |

## 🌐 Environment Variables

Required in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
```

## 🚀 Deployment Checklist

- [ ] All SQL migrations run
- [ ] Storage buckets created
- [ ] Environment variables set
- [ ] RLS policies enabled
- [ ] Realtime enabled
- [ ] Test file upload
- [ ] Test voice channel
- [ ] Test private call

## 💡 Pro Tips

- Upload images directly by pasting (Ctrl/Cmd + V)
- Create voice channels for team meetings
- Use markdown in messages for formatting
- Reply to messages to keep context
- Generate new invite links if old ones expire
- Mute yourself before joining voice channels
- Toggle video off to save bandwidth

## 📞 Support

Check these in order:
1. Browser console (F12)
2. Supabase logs
3. SQL migration status
4. Storage bucket policies
5. RLS policies
