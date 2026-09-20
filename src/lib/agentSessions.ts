// src/lib/agentSessions.ts
import type { AgentSession, AgentSessionInsert, AgentSessionUpdate } from './database.types';
import { createChat, addMessage, fetchMessages } from './chats';
import type { Chat, Message, MessageInsert, Provider } from './database.types';

const KEY = 'nexus-local-agent-sessions';

function now() {
  return new Date().toISOString();
}

function id() {
  return crypto.randomUUID();
}

function read(): AgentSession[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function write(sessions: AgentSession[]) {
  localStorage.setItem(KEY, JSON.stringify(sessions));
}

export async function fetchAgentSessions(): Promise<AgentSession[]> {
  return read().sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function createAgentSession(
  row: AgentSessionInsert & { provider?: Provider },
): Promise<AgentSession> {
  const timestamp = now();
  const session: AgentSession = {
    id: row.id ?? id(),
    user_id: 'local-nexus-user',
    agent_type: row.agent_type,
    title: row.title ?? 'Agent session',
    status: row.status ?? 'planning',
    plan: row.plan ?? null,
    current_step: row.current_step ?? 0,
    model: row.model ?? 'groq/openai/gpt-oss-120b',
    provider: row.provider ?? 'groq',
    chat_id: row.chat_id ?? null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  write([session, ...read()]);
  return session;
}

export async function updateAgentSession(id: string, updates: AgentSessionUpdate): Promise<void> {
  write(
    read().map((s) => (s.id === id ? { ...s, ...updates, updated_at: now() } : s)),
  );
}

export async function deleteAgentSession(id: string): Promise<void> {
  write(read().filter((s) => s.id !== id));
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
