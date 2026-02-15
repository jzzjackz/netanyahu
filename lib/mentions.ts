// Helper functions for @mentions

export function extractMentions(content: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const matches = content.matchAll(mentionRegex);
  return Array.from(matches, m => m[1]);
}

export function highlightMentions(content: string, currentUsername: string): string {
  return content.replace(/@(\w+)/g, (match, username) => {
    const isSelf = username === currentUsername;
    const className = isSelf ? 'mention-self' : 'mention';
    return `<span class="${className}">@${username}</span>`;
  });
}

export async function createMentions(
  supabase: any,
  messageId: string,
  channelId: string,
  content: string,
  authorId: string
) {
  const usernames = extractMentions(content);
  if (usernames.length === 0) return;

  // Get user IDs from usernames
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username")
    .in("username", usernames);

  if (!profiles || profiles.length === 0) return;

  // Create mention records
  const mentions = profiles
    .filter((p: any) => p.id !== authorId) // Don't mention yourself
    .map((p: any) => ({
      message_id: messageId,
      mentioned_user_id: p.id,
      channel_id: channelId,
    }));

  if (mentions.length > 0) {
    await supabase.from("mentions").insert(mentions);
  }
}

export async function createDMMentions(
  supabase: any,
  messageId: string,
  conversationId: string,
  content: string,
  authorId: string
) {
  const usernames = extractMentions(content);
  if (usernames.length === 0) return;

  // Get user IDs from usernames
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username")
    .in("username", usernames);

  if (!profiles || profiles.length === 0) return;

  // Create mention records
  const mentions = profiles
    .filter((p: any) => p.id !== authorId) // Don't mention yourself
    .map((p: any) => ({
      message_id: messageId,
      mentioned_user_id: p.id,
      conversation_id: conversationId,
    }));

  if (mentions.length > 0) {
    await supabase.from("dm_mentions").insert(mentions);
  }
}
