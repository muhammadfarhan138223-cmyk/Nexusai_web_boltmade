import { supabase } from './supabase';
import type { Chat, ChatInsert, Message, MessageInsert, Provider, Attachment } from './database.types';
import { deriveChatTitle } from './utils';

/**
 * Data-access layer for chats & messages. The supabase client is untyped, so
 * we cast query results to our row types at this boundary. UI components
 * consume fully-typed rows from here.
 */

export async function fetchChats(): Promise<Chat[]> {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Chat[];
}

export async function fetchMessages(chatId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function createChat(
  init?: Partial<ChatInsert> & { provider?: Provider; model?: string },
): Promise<Chat> {
  const { data, error } = await supabase
    .from('chats')
    .insert({
      title: init?.title ?? 'New chat',
      provider: init?.provider ?? 'groq',
      model: init?.model ?? 'groq/llama-3.3-70b-versatile',
    })
    .select()
    .single();
  if (error) throw error;
  return data as Chat;
}

export async function renameChat(chatId: string, title: string): Promise<void> {
  const { error } = await supabase.from('chats').update({ title }).eq('id', chatId);
  if (error) throw error;
}

export async function toggleChatPin(chatId: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.from('chats').update({ pinned }).eq('id', chatId);
  if (error) throw error;
}

export async function setChatModel(chatId: string, provider: Provider, model: string): Promise<void> {
  const { error } = await supabase.from('chats').update({ provider, model }).eq('id', chatId);
  if (error) throw error;
}

export async function deleteChat(chatId: string): Promise<void> {
  const { error } = await supabase.from('chats').delete().eq('id', chatId);
  if (error) throw error;
}

export async function addMessage(msg: MessageInsert): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert(msg)
    .select()
    .single();
  if (error) throw error;
  return data as Message;
}

export async function updateMessageContent(id: string, content: string, tokens?: number): Promise<void> {
  const payload: Record<string, unknown> = { content };
  if (typeof tokens === 'number') payload.tokens = tokens;
  const { error } = await supabase.from('messages').update(payload).eq('id', id);
  if (error) throw error;
}

/**
 * Insert the first user message of a chat and auto-title the chat from it.
 */
export async function seedFirstUserMessage(
  chatId: string,
  content: string,
  attachments?: Attachment[] | null,
): Promise<Message> {
  const msg = await addMessage({
    chat_id: chatId,
    role: 'user',
    content,
    attachments: attachments ?? null,
  });
  await renameChat(chatId, deriveChatTitle(content || 'Attached media'));
  return msg;
}

/**
 * Substring search across a user's chats + messages for the search bar.
 * Returns chat rows whose title contains the query OR that have a message
 * containing the query.
 */
export async function searchChats(query: string): Promise<Chat[]> {
  const q = query.trim();
  if (!q) return [];
  const like = `%${q}%`;

  const { data: byTitle, error: e1 } = await supabase
    .from('chats')
    .select('*')
    .ilike('title', like)
    .order('updated_at', { ascending: false });
  if (e1) throw e1;

  const { data: byMsg, error: e2 } = await supabase
    .from('messages')
    .select('chat_id')
    .ilike('content', like);
  if (e2) throw e2;

  const ids = Array.from(new Set((byMsg ?? []).map((m: { chat_id: string }) => m.chat_id)));
  let byId: Chat[] = [];
  if (ids.length) {
    const { data, error: e3 } = await supabase
      .from('chats')
      .select('*')
    .in('id', ids)
      .order('updated_at', { ascending: false });
    if (e3) throw e3;
    byId = (data ?? []) as Chat[];
  }

  const seen = new Set<string>();
  const merged: Chat[] = [];
  for (const c of [...((byTitle ?? []) as Chat[]), ...byId]) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      merged.push(c);
    }
  }
  return merged;
}
