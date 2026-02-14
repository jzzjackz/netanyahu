# What's New - Latest Update

## 🎉 Major Features Added

### 📎 File Uploads & Attachments
Upload any file type in messages! Images display inline, other files show as download links.

**How to use:**
- Click the `+` button in message input
- Select files (multiple selection supported)
- Send your message with attachments

**Works in:**
- ✅ Server text channels
- ✅ Direct messages

### 🖼️ Image Embeds
Images automatically render inline with nice styling and click-to-expand functionality.

### 🔊 Voice Channels - REAL WEBRTC AUDIO
Create and join voice channels with actual working audio streaming!

**Features:**
- ✅ Real peer-to-peer audio using WebRTC
- ✅ Automatic echo cancellation and noise suppression
- ✅ Real-time participant list
- ✅ Mute/unmute microphone (actually works!)
- ✅ Deafen/undeafen audio (actually works!)
- ✅ Leave call button
- ✅ Connection status indicator
- ✅ Uses Google STUN servers for NAT traversal

**How to use:**
1. Server owner creates voice channel
2. Click voice channel to join
3. Allow microphone access when prompted
4. Talk with other users in real-time!

### 📞 Private Calls - REAL WEBRTC VIDEO/AUDIO
Start actual working voice or video calls with friends in direct messages!

**Features:**
- ✅ Real peer-to-peer video/audio using WebRTC
- ✅ Full-screen call interface
- ✅ Video on/off toggle (actually enables/disables camera!)
- ✅ Mute/deafen controls (actually work!)
- ✅ Self video preview
- ✅ Connection status
- ✅ Automatic echo cancellation
- ✅ Uses Google STUN servers

**How to use:**
1. Open a DM with a friend
2. Click phone icon (voice) or video icon (video)
3. Allow microphone/camera access when prompted
4. See and hear each other in real-time!

## 🎯 Technical Implementation

### WebRTC Features
- **Peer-to-peer connections** using RTCPeerConnection
- **STUN servers** for NAT traversal (stun.l.google.com)
- **Signaling** via Supabase Realtime broadcast channels
- **Media constraints**:
  - Echo cancellation enabled
  - Noise suppression enabled
  - Auto gain control enabled
- **Dynamic video** - can toggle camera on/off during call
- **Audio routing** - remote audio plays through speakers automatically

### How It Works
1. User joins voice channel or starts call
2. Browser requests microphone/camera permission
3. Local media stream created
4. WebRTC peer connections established with other users
5. SDP offers/answers exchanged via Supabase Realtime
6. ICE candidates exchanged for NAT traversal
7. Direct peer-to-peer audio/video streaming begins
8. Audio plays automatically through speakers
9. Video displays in video elements

## 📋 Files Changed

### New Components
- `components/VoiceCall.tsx` - Real WebRTC voice channel implementation
- `components/PrivateCall.tsx` - Real WebRTC video/audio call implementation

### Updated Components
- `components/ChatArea.tsx` - File upload, image rendering, voice channel view, DM calls
- `components/AppShell.tsx` - Voice call integration
- `components/ChannelSidebar.tsx` - Voice channel creation

### Updated Types
- `lib/types.ts` - Added attachments to Message and DirectMessage

### New SQL Migrations
- `supabase/add-attachments.sql` - Attachments column and storage bucket
- `supabase/add-voice-channels.sql` - Voice channel realtime support

## 🚀 Getting Started

### 1. Run SQL Migrations

In Supabase SQL Editor, run:
```sql
-- Run these in order:
1. add-attachments.sql
2. add-voice-channels.sql
```

### 2. Test It Out

**File Uploads:**
- Go to any channel
- Click `+` button
- Upload an image
- See it display inline!

**Voice Channels (REAL AUDIO):**
- Create a voice channel (server owner)
- Click to join
- Allow microphone access
- Talk with others - they'll hear you!
- Test mute/deafen buttons

**Private Calls (REAL VIDEO/AUDIO):**
- Open a DM
- Click phone or video icon
- Allow camera/microphone access
- See and hear the other person!
- Toggle video on/off during call

## 🎨 UI/UX Improvements

- File upload button with intuitive `+` icon
- Selected files preview before sending
- Image embeds with max dimensions and hover effects
- Download links for non-image files with file icon
- Voice channel section in sidebar with 🔊 icon
- Call UI with professional controls
- Real-time participant tracking
- Connection status indicators
- Video preview for self and remote user
- Smooth video toggle transitions

## 🔧 Technical Details

**File Storage:**
- Files stored in Supabase Storage `attachments` bucket
- Metadata saved in message.attachments jsonb field
- Public read access, authenticated upload

**Voice/Video:**
- ✅ Uses native browser WebRTC APIs
- ✅ Peer-to-peer connections (no media server needed)
- ✅ STUN servers for NAT traversal
- ✅ Supabase Realtime for signaling
- ✅ Automatic audio playback
- ✅ Dynamic video track management

**Real-time:**
- Participant list updates live
- Call state synchronized across clients
- WebRTC signaling via broadcast channels
- ICE candidate exchange
- SDP offer/answer exchange

## ⚠️ Important Notes

### Browser Permissions Required
Users must allow:
- Microphone access for voice channels and calls
- Camera access for video calls (optional, can toggle)

### Network Requirements
- Works on most networks
- Uses STUN servers for NAT traversal
- Peer-to-peer connections (no media server)
- May not work behind very restrictive firewalls

### Browser Compatibility
Works in:
- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Opera

### File Size Limits
Default Supabase limits:
- Max file size: 50MB
- Storage quota: 1GB (free tier)

## 🐛 Known Issues

**If audio doesn't work:**
1. Check browser permissions (microphone allowed?)
2. Check browser console for errors
3. Try refreshing the page
4. Make sure you're on HTTPS (required for WebRTC)

**If video doesn't work:**
1. Check camera permissions
2. Try toggling video off and on
3. Check if camera is being used by another app

## 📚 Next Steps

Want to enhance further? Consider:
- Add TURN servers for better connectivity
- Screen sharing support
- Recording functionality
- Message reactions
- Server roles/permissions
- Push notifications

## 💡 Tips

**Voice Channels:**
- Mute yourself before joining if in noisy environment
- Use deafen to stop hearing others
- Multiple people can join same voice channel
- Audio quality adjusts automatically

**Video Calls:**
- Start with audio only, enable video when ready
- Toggle video off to save bandwidth
- Self preview shows in bottom-right corner
- Video works peer-to-peer (no server delay)

**File Uploads:**
- Upload multiple files at once
- Remove files before sending by clicking ✕
- Images auto-embed, no special formatting needed

Enjoy the REAL working voice and video features! 🎊

## 📋 Files Changed

### New Components
- `components/VoiceCall.tsx` - Voice channel call UI
- `components/PrivateCall.tsx` - Private call UI for DMs

### Updated Components
- `components/ChatArea.tsx` - Added file upload, image rendering, voice channel view
- `components/AppShell.tsx` - Integrated voice call component
- `components/ChannelSidebar.tsx` - Added voice channel creation

### Updated Types
- `lib/types.ts` - Added attachments to Message and DirectMessage

### New SQL Migrations
- `supabase/add-attachments.sql` - Attachments column and storage bucket
- `supabase/add-voice-channels.sql` - Voice channel realtime support

### Documentation
- `FEATURES.md` - Complete feature documentation
- `SETUP-GUIDE.md` - Setup and troubleshooting guide
- `WHATS-NEW.md` - This file!

## 🚀 Getting Started

### 1. Run SQL Migrations

In Supabase SQL Editor, run:
```sql
-- Run these in order:
1. add-attachments.sql
2. add-voice-channels.sql
```

### 2. Test It Out

**File Uploads:**
- Go to any channel
- Click `+` button
- Upload an image
- See it display inline!

**Voice Channels:**
- Create a voice channel (server owner)
- Click to join
- See the call UI

**Private Calls:**
- Open a DM
- Click phone or video icon
- Full-screen call interface!

## 🎨 UI/UX Improvements

- File upload button with intuitive `+` icon
- Selected files preview before sending
- Image embeds with max dimensions and hover effects
- Download links for non-image files with file icon
- Voice channel section in sidebar with 🔊 icon
- Call UI with professional controls
- Real-time participant tracking
- Connection status indicators

## 🔧 Technical Details

**File Storage:**
- Files stored in Supabase Storage `attachments` bucket
- Metadata saved in message.attachments jsonb field
- Public read access, authenticated upload

**Voice/Video:**
- Uses Supabase Realtime for presence
- Broadcast channels for join/leave events
- Ready for WebRTC integration

**Real-time:**
- Participant list updates live
- Call state synchronized across clients
- Typing indicators show specific users

## ⚠️ Important Notes

### WebRTC Not Included
The voice/video features provide complete UI and presence tracking, but actual audio/video streaming requires WebRTC integration with services like:
- Daily.co
- Agora
- Twilio Video

The foundation is ready - just add your preferred WebRTC provider!

### File Size Limits
Default Supabase limits:
- Max file size: 50MB
- Storage quota: 1GB (free tier)

Upgrade in Supabase Dashboard if needed.

## 🐛 Known Issues

None currently! If you find any:
1. Check browser console
2. Verify SQL migrations ran
3. Check Supabase logs

## 📚 Next Steps

Want to enhance further? Consider:
- Integrate WebRTC for actual audio/video
- Add screen sharing
- Message reactions
- Server roles/permissions
- Push notifications

## 💡 Tips

**File Uploads:**
- Upload multiple files at once
- Remove files before sending by clicking ✕
- Images auto-embed, no special formatting needed

**Voice Channels:**
- Only server owners can create channels
- Anyone can join voice channels
- Mute yourself before joining if needed

**Private Calls:**
- Both voice and video buttons start the same call
- Toggle video on/off during call
- Deafen to stop hearing audio

Enjoy the new features! 🎊
