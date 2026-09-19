import { useCallback, useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { ChatView } from '@/components/chat/ChatView';
import { SettingsView } from '@/components/settings/SettingsView';
import { DocumentsView } from '@/components/documents/DocumentsView';
import { VideoView } from '@/components/video/VideoView';
import { AgentHub } from '@/components/agents/AgentHub';
import { AgentSessionView } from '@/components/agents/AgentSessionView';
import { useAuth } from '@/context/AuthContext';
import { fetchChats } from '@/lib/chats';
import { fetchAgentSessions } from '@/lib/agentSessions';
import type { Chat, AgentSession } from '@/lib/database.types';
import type { AgentDefinition } from '@/lib/agents';
import { AGENTS_MAP } from '@/lib/agents';

type View = 'chat' | 'settings' | 'documents' | 'video' | 'agents' | 'agent-session';

interface AppLayoutProps {
  initialChatId?: string | null;
}

export function AppLayout({ initialChatId }: AppLayoutProps) {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [agentSessions, setAgentSessions] = useState<AgentSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(initialChatId ?? null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState<View>('chat');
  const [activeAgent, setActiveAgent] = useState<AgentDefinition | null>(null);
  const [activeAgentSession, setActiveAgentSession] = useState<AgentSession | null>(null);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;

  const reloadChats = useCallback(async () => {
    try {
      const list = await fetchChats();
      setChats(list);
    } catch {
      // non-fatal: keep current list
    }
  }, []);

  const reloadAgentSessions = useCallback(async () => {
    try {
      const list = await fetchAgentSessions();
      setAgentSessions(list);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    if (user) {
      reloadChats();
      reloadAgentSessions();
    }
  }, [user, reloadChats, reloadAgentSessions]);

  // If arriving via a shared link (?c=<id>), ensure the target chat is
  // selectable even if it hasn't been loaded yet. fetchChats loads all the
  // user's chats, so once that resolves the activeChat lookup will find it.
  // If the chat belongs to the user, it appears in the list. If not, the
  // user simply sees a "new chat" state — no crash.

  const onSelectChat = useCallback((id: string) => {
    setActiveChatId(id);
    setView('chat');
    setSidebarOpen(false);
  }, []);

  const onNewChat = useCallback(() => {
    setActiveChatId(null);
    setView('chat');
    setSidebarOpen(false);
  }, []);

  const onChatCreated = useCallback((chat: Chat) => {
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
  }, []);

  const onChatUpdated = useCallback((chat: Chat) => {
    setChats((prev) => prev.map((c) => (c.id === chat.id ? chat : c)));
  }, []);

  const onOpenSettings = useCallback(() => {
    setView('settings');
    setSidebarOpen(false);
  }, []);
  const onOpenDocuments = useCallback(() => {
    setView('documents');
    setSidebarOpen(false);
  }, []);
  const onOpenVideo = useCallback(() => {
    setView('video');
    setSidebarOpen(false);
  }, []);
  const onOpenAgents = useCallback(() => {
    setView('agents');
    setSidebarOpen(false);
  }, []);
  const onStartAgent = useCallback((agent: AgentDefinition) => {
    setActiveAgent(agent);
    setActiveAgentSession(null);
    setView('agent-session');
    setSidebarOpen(false);
  }, []);
  const onOpenAgentSession = useCallback((s: AgentSession) => {
    const def = AGENTS_MAP.get(s.agent_type);
    if (def) {
      setActiveAgent(def);
      setActiveAgentSession(s);
      setView('agent-session');
    }
    setSidebarOpen(false);
  }, []);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-surface-subtle dark:bg-surface-dark">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeChatId={activeChatId}
        onSelectChat={onSelectChat}
        onNewChat={onNewChat}
        onOpenSettings={onOpenSettings}
        onOpenDocuments={onOpenDocuments}
        onOpenVideo={onOpenVideo}
        onOpenAgents={onOpenAgents}
        onOpenAgentSession={onOpenAgentSession}
        chats={chats}
        reloadChats={reloadChats}
        agentSessions={agentSessions}
        reloadAgentSessions={reloadAgentSessions}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        {view === 'chat' && (
          <ChatView
            chat={activeChat}
            onOpenSidebar={() => setSidebarOpen(true)}
            onChatCreated={onChatCreated}
            onChatUpdated={onChatUpdated}
            onOpenDocuments={onOpenDocuments}
            onNavigateChat={onSelectChat}
          />
        )}
        {view === 'settings' && <SettingsView onBack={() => setView('chat')} />}
        {view === 'documents' && <DocumentsView onBack={() => setView('chat')} />}
        {view === 'video' && <VideoView onBack={() => setView('chat')} />}
        {view === 'agents' && (
          <AgentHub onStartAgent={onStartAgent} onBack={() => setView('chat')} />
        )}
        {view === 'agent-session' && activeAgent && (
          <AgentSessionView
            agent={activeAgent}
            existingSession={activeAgentSession}
            onBack={() => setView('agents')}
            onSessionCreated={(s) => {
              setAgentSessions((prev) => [s, ...prev]);
            }}
            onSessionUpdated={(s) => {
              setAgentSessions((prev) => prev.map((x) => (x.id === s.id ? s : x)));
            }}
          />
        )}
      </main>
    </div>
  );
}
