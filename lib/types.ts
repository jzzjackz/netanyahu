export type ServerRole = "owner" | "admin" | "mod" | "member";
export type ChannelType = "text" | "voice";
export type FriendRequestStatus = "pending" | "accepted" | "rejected";

export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  status: string;
  created_at: string;
}

export interface Server {
  id: string;
  owner_id: string | null;
  name: string;
  icon_url: string | null;
  created_at: string;
}

export interface ServerMember {
  server_id: string;
  user_id: string;
  role: ServerRole;
  joined_at: string;
  profiles?: Profile | null;
}

export interface Channel {
  id: string;
  server_id: string;
  name: string;
  type: ChannelType;
  position: number;
  created_at: string;
}

export interface Message {
  id: string;
  channel_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
  edited_at: string | null;
  reply_to: string | null;
  profiles?: Profile | null;
  reply_message?: Message | null;
}

export interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: FriendRequestStatus;
  created_at: string;
  from_profile?: Profile | null;
  to_profile?: Profile | null;
}

export interface DirectConversation {
  id: string;
  user_a_id: string;
  user_b_id: string;
  created_at: string;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
  edited_at: string | null;
  profiles?: Profile | null;
}

export interface InviteCode {
  id: number;
  server_id: number;
  code: string;
  created_by: number | null;
  expires_at: string | null;
  created_at: string;
}

export interface Video {
  id: string;
  uploader_id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration: number | null;
  views: number;
  created_at: string;
  updated_at: string;
  profiles?: Profile | null;
}

export interface VideoComment {
  id: string;
  video_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  profiles?: Profile | null;
}
