export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: number;
}

export const getSavedMessages = (): ChatMessage[] => {
  const saved = localStorage.getItem('nexus_chat_history');
  return saved ? JSON.parse(saved) : [];
};

export const saveMessage = (msg: ChatMessage) => {
  const current = getSavedMessages();
  const updated = [...current, msg];
  localStorage.setItem('nexus_chat_history', JSON.stringify(updated));
  return updated;
};

export const clearChatHistory = () => {
  localStorage.removeItem('nexus_chat_history');
};
