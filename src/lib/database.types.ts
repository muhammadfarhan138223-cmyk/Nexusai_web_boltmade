// Database types for Nexus AI.
// Supabase v2 requires each table to declare Row/Insert/Update/Relationships
// for the typed client to infer insert/update payloads correctly.

export type Provider = 'groq' | 'gemini' | 'openrouter';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
        };
        Update: {
          full_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          user_id: string;
          default_provider: Provider;
          default_model: string;
          system_prompt: string;
          temperature: number;
          theme: 'light' | 'dark' | 'system';
          updated_at: string;
        };
        Insert: {
          user_id: string;
          default_provider?: Provider;
          default_model?: string;
          system_prompt?: string;
          temperature?: number;
          theme?: 'light' | 'dark' | 'system';
        };
        Update: {
          user_id?: string;
          default_provider?: Provider;
          default_model?: string;
          system_prompt?: string;
          temperature?: number;
          theme?: 'light' | 'dark' | 'system';
        };
        Relationships: [];
      };
      chats: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          provider: Provider;
          model: string;
          pinned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title?: string;
          provider?: Provider;
          model?: string;
          pinned?: boolean;
        };
        Update: {
          title?: string;
          provider?: Provider;
          model?: string;
          pinned?: boolean;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          chat_id: string;
          user_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          provider: Provider | null;
          model: string | null;
          tokens: number | null;
          attachments: Attachment[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          chat_id: string;
          user_id?: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          provider?: Provider | null;
          model?: string | null;
          tokens?: number | null;
          attachments?: Attachment[] | null;
        };
        Update: {
          content?: string;
          tokens?: number | null;
          attachments?: Attachment[] | null;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          user_id: string;
          filename: string;
          storage_path: string;
          char_count: number;
          summary: string | null;
          key_points: string[] | null;
          status: 'uploaded' | 'processing' | 'ready' | 'failed';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          filename: string;
          storage_path: string;
          char_count?: number;
          summary?: string | null;
          key_points?: string[] | null;
          status?: 'uploaded' | 'processing' | 'ready' | 'failed';
        };
        Update: {
          summary?: string | null;
          key_points?: string[] | null;
          status?: 'uploaded' | 'processing' | 'ready' | 'failed';
        };
        Relationships: [];
      };
      daily_usage: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          request_count: number;
          image_count: number;
          video_count: number;
          last_request_at: string | null;
          recent_request_times: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          date?: string;
          request_count?: number;
          image_count?: number;
          video_count?: number;
          last_request_at?: string | null;
          recent_request_times?: string[];
        };
        Update: {
          request_count?: number;
          image_count?: number;
          video_count?: number;
          last_request_at?: string | null;
          recent_request_times?: string[];
        };
        Relationships: [];
      };
      videos: {
        Row: {
          id: string;
          user_id: string;
          input_image_path: string | null;
          input_image_url: string | null;
          prompt: string | null;
          status: 'queued' | 'processing' | 'succeeded' | 'failed';
          prediction_id: string | null;
          video_url: string | null;
          error: string | null;
          model: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          input_image_path?: string | null;
          input_image_url?: string | null;
          prompt?: string | null;
          status?: 'queued' | 'processing' | 'succeeded' | 'failed';
          prediction_id?: string | null;
          video_url?: string | null;
          error?: string | null;
          model?: string;
        };
        Update: {
          status?: 'queued' | 'processing' | 'succeeded' | 'failed';
          prediction_id?: string | null;
          video_url?: string | null;
          error?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type UserPreferences = Database['public']['Tables']['user_preferences']['Row'];
export type Chat = Database['public']['Tables']['chats']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type DocumentRow = Database['public']['Tables']['documents']['Row'];
export type VideoRow = Database['public']['Tables']['videos']['Row'];
export type VideoInsert = Database['public']['Tables']['videos']['Insert'];
export type VideoUpdate = Database['public']['Tables']['videos']['Update'];
export type ChatInsert = Database['public']['Tables']['chats']['Insert'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];

export type AgentSession = {
  id: string;
  user_id: string;
  agent_type: string;
  title: string;
  status: 'planning' | 'awaiting_approval' | 'building' | 'paused' | 'completed' | 'failed';
  plan: AgentPlanStep[] | null;
  current_step: number;
  model: string;
  provider: string;
  chat_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AttachmentType = 'image' | 'audio' | 'video';

export interface Attachment {
  type: AttachmentType;
  url: string;
  name: string;
  mime: string;
  size: number;
}

export type DailyUsage = Database['public']['Tables']['daily_usage']['Row'];
export type DailyUsageInsert = Database['public']['Tables']['daily_usage']['Insert'];
export type DailyUsageUpdate = Database['public']['Tables']['daily_usage']['Update'];

export type AgentPlanStep = {
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'done' | 'skipped';
};

export type AgentSessionInsert = {
  id?: string;
  agent_type: string;
  title?: string;
  status?: AgentSession['status'];
  plan?: AgentPlanStep[] | null;
  current_step?: number;
  model?: string;
  provider?: string;
  chat_id?: string | null;
};

export type AgentSessionUpdate = {
  title?: string;
  status?: AgentSession['status'];
  plan?: AgentPlanStep[] | null;
  current_step?: number;
  model?: string;
  provider?: string;
};
