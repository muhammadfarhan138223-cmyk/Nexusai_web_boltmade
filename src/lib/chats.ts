import type {
  Chat,
  ChatInsert,
  Message,
  MessageInsert,
  Provider,
  Attachment,
} from './database.types';
import { deriveChatTitle } from './utils';

const CHAT_KEY = 'nexus-local-chats';
const MESSAGE_KEY = 'nexus-local-messages';

const USER_ID = 'local-nexus-user';

function now() {
  return new Date().toISOString();
}

function id() {
  return crypto.randomUUID();
}

function readChats(): Chat[] {
  try {
    return JSON.parse(localStorage.getItem(CHAT_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveChats(chats: Chat[]) {
  localStorage.setItem(CHAT_KEY, JSON.stringify(chats));
}

function readMessages(): Message[] {
  try {
    return JSON.parse(localStorage.getItem(MESSAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveMessages(messages: Message[]) {
  localStorage.setItem(MESSAGE_KEY, JSON.stringify(messages));
}

export async function fetchChats(): Promise<Chat[]> {
  return readChats().sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

export async function fetchMessages(chatId: string): Promise<Message[]> {
  return readMessages()
    .filter((m) => m.chat_id === chatId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function createChat(
  init?: Partial<ChatInsert> & {
    provider?: Provider;
    model?: string;
  },
): Promise<Chat> {
  const timestamp = now();

  const chat: Chat = {
    id: id(),
    user_id: USER_ID,
    title: init?.title ?? 'New chat',
    provider: init?.provider ?? 'groq',
    model: init?.model ?? 'groq/openai/gpt-oss-120b',
    pinned: init?.pinned ?? false,
    created_at: timestamp,
    updated_at: timestamp,
  };

  saveChats([chat, ...readChats()]);
  return chat;
}

export async function renameChat(chatId: string, title: string): Promise<void> {
  saveChats(
    readChats().map((c) =>
      c.id === chatId
        ? { ...c, title, updated_at: now() }
        : c,
    ),
  );
}

export async function toggleChatPin(
  chatId: string,
  pinned: boolean,
): Promise<void> {
  saveChats(
    readChats().map((c) =>
      c.id === chatId
        ? { ...c, pinned, updated_at: now() }
        : c,
    ),
  );
}

export async function setChatModel(
  chatId: string,
  provider: Provider,
  model: string,
): Promise<void> {
  saveChats(
    readChats().map((c) =>
      c.id === chatId
        ? { ...c, provider, model, updated_at: now() }
        : c,
    ),
  );
}

export async function deleteChat(chatId: string): Promise<void> {
  saveChats(readChats().filter((c) => c.id !== chatId));
  saveMessages(readMessages().filter((m) => m.chat_id !== chatId));
}

export async function addMessage(msg: MessageInsert): Promise<Message> {
  const message: Message = {
    id: msg.id ?? id(),
    chat_id: msg.chat_id,
    user_id: USER_ID,
    role: msg.role,
    content: msg.content,
    provider: msg.provider ?? null,
    model: msg.model ?? null,
    tokens: msg.tokens ?? null,
    attachments: msg.attachments ?? null,
    created_at: now(),
  };

  saveMessages([...readMessages(), message]);

  saveChats(
    readChats().map((c) =>
      c.id === message.chat_id
        ? { ...c, updated_at: message.created_at }
        : c,
    ),
  );

  return message;
}

export async function updateMessageContent(
  id: string,
  content: string,
  tokens?: number,
): Promise<void> {
  saveMessages(
    readMessages().map((m) =>
      m.id === id
        ? {
            ...m,
            content,
            ...(typeof tokens === 'number' ? { tokens } : {}),
          }
        : m,
    ),
  );
}

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

  await renameChat(
    chatId,
    deriveChatTitle(content || 'Attached media'),
  );

  return msg;
}

export async function searchChats(query: string): Promise<Chat[]> {
  const q = query.trim().toLowerCase();

  if (!q) return [];

  const chats = readChats();
  const messages = readMessages();

  const matchingIds = new Set(
    messages
      .filter((m) => m.content.toLowerCase().includes(q))
      .map((m) => m.chat_id),
  );

  return chats.filter(
    (c) =>
      c.title.toLowerCase().includes(q) ||
      matchingIds.has(c.id),
  );
    }
