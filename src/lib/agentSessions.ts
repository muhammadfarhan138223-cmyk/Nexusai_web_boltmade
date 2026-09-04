import { supabase } from './supabase';
import type { AgentSession, AgentSessionInsert, AgentSessionUpdate } from './database.types';
import { createChat, addMessage, fetchMessages } from './chats';
import type { Chat, Message, MessageInsert, Provider } from './database.types';

export async function fetchAgentSessions(): Promise<AgentSession[]> {
  const { data, error } = await supabase
    .from('agent_sessions')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AgentSession[];
}

export async function createAgentSession(
  row: AgentSessionInsert & { provider?: Provider },
): Promise<AgentSession> {
  const { data, error } = await supabase
    .from('agent_sessions')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as AgentSession;
}

export async function updateAgentSession(
  id: string,
  updates: AgentSessionUpdate,
): Promise<void> {
  const { error } = await supabase.from('agent_sessions').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteAgentSession(id: string): Promise<void> {
  const { error } = await supabase.from('agent_sessions').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Create a new agent session with a linked chat. The chat is used as shared
 * memory — all agent messages live in the same chat infrastructure as regular
 * chats, so history, search, and export all work seamlessly.
 */
export async function startAgentSession(
  agentType: string,
  model: string,
  provider: Provider,
  title: string,
): Promise<{ session: AgentSession; chat: Chat }> {
  const chat = await createChat({ provider, model, title });
  const session = await createAgentSession({
    agent_type: agentType,
    title,
    model,
    provider,
    chat_id: chat.id,
    status: 'planning',
  });
  return { session, chat };
}

export async function addAgentMessage(
  chatId: string,
  role: 'user' | 'assistant',
  content: string,
  model?: string,
  provider?: Provider,
): Promise<Message> {
  const msg: MessageInsert = {
    chat_id: chatId,
    role,
    content,
  };
  if (model) msg.model = model;
  if (provider) msg.provider = provider;
  return addMessage(msg);
}

export async function getAgentMessages(chatId: string): Promise<Message[]> {
  return fetchMessages(chatId);
}
