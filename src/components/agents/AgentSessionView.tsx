import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Sparkles,
  Send,
  Square,
  Check,
  X,
  Pause,
  Play,
  Edit3,
  Loader2,
  CheckCircle2,
  CircleDot,
  Circle,
  AlertCircle,
} from 'lucide-react';
import { Seo } from '@/components/ui/Seo';
import { Button } from '@/components/ui/Button';
import { ModelSelector } from '@/components/ui/ModelSelector';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { streamChatCompletion } from '@/lib/ai';
import { getModel } from '@/lib/models';
import type { AgentDefinition } from '@/lib/agents';
import type { AgentSession, AgentPlanStep, Message, Provider } from '@/lib/database.types';
import {
  startAgentSession,
  updateAgentSession,
  addAgentMessage,
  getAgentMessages,
} from '@/lib/agentSessions';
import { clsx } from '@/lib/clsx';

interface AgentSessionViewProps {
  agent: AgentDefinition;
  existingSession?: AgentSession | null;
  onBack: () => void;
  onSessionCreated?: (session: AgentSession) => void;
  onSessionUpdated?: (session: AgentSession) => void;
}

type Phase = 'asking' | 'plan_ready' | 'building' | 'paused' | 'done';

export function AgentSessionView({
  agent,
  existingSession,
  onBack,
  onSessionCreated,
  onSessionUpdated,
}: AgentSessionViewProps) {
  const { preferences } = useAuth();
  const toast = useToast();
  const Icon = agent.icon;

  const [session, setSession] = useState<AgentSession | null>(existingSession ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [loading, setLoading] = useState(!existingSession);
  const [model, setModel] = useState(
    existingSession?.model ?? preferences?.default_model ?? 'groq/openai/gpt-oss-120b',
  );
  const [phase, setPhase] = useState<Phase>(
    existingSession?.status === 'building'
      ? 'building'
      : existingSession?.status === 'completed'
        ? 'done'
        : existingSession?.status === 'paused'
          ? 'paused'
          : 'asking',
  );
  const [plan, setPlan] = useState<AgentPlanStep[] | null>(existingSession?.plan ?? null);
  const [editingPlan, setEditingPlan] = useState(false);
  const [editedPlan, setEditedPlan] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Bootstrap a new session or load messages for an existing one.
  useEffect(() => {
    if (existingSession) {
      loadMessages(existingSession.chat_id);
      return;
    }
    initSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initSession() {
    setLoading(true);
    try {
      const opt = getModel(model);
      const provider = (opt?.provider ?? 'groq') as Provider;
      const { session: newSession, chat } = await startAgentSession(
        agent.id,
        model,
        provider,
        `${agent.name} session`,
      );
      setSession(newSession);
      onSessionCreated?.(newSession);

      // Send the agent's initial question as the first assistant message.
      const agentMsg = await addAgentMessage(
        chat.id,
        'assistant',
        agent.initialQuestion,
        model,
        provider,
      );
      setMessages([agentMsg]);
    } catch {
      toast.error('Could not start the agent session.');
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(chatId: string | null) {
    if (!chatId) return;
    try {
      const msgs = await getAgentMessages(chatId);
      setMessages(msgs);
    } catch {
      // non-fatal
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, streamingContent]);

  const runStream = useCallback(
    async (history: Message[], userMsgContent: string) => {
      if (!session?.chat_id) return;
      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);
      setStreamingContent('');

      const opt = getModel(model);
      const provider = (opt?.provider ?? 'groq') as Provider;
      const apiMessages = history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      let acc = '';
      try {
        for await (const delta of streamChatCompletion({
          messages: apiMessages,
          model,
          temperature: preferences?.temperature ?? 0.7,
          systemPrompt:
            agent.systemPrompt +
            (preferences?.system_prompt ? `\n\nAdditional user instructions: ${preferences.system_prompt}` : '') +
            (agent.planFormatInstruction ?? PLAN_FORMAT_INSTRUCTION),
          signal: controller.signal,
        })) {
          acc += delta;
          setStreamingContent(acc);
        }

        const finalContent = acc || '(no response)';
        const assistantMsg = await addAgentMessage(
          session.chat_id,
          'assistant',
          finalContent,
          model,
          provider,
        );
        setMessages((prev) => [...prev, assistantMsg]);

        // Check if the response contains a plan (JSON code block with "plan" key).
        const planMatch = finalContent.match(/```json\s*([\s\S]*?)```/);
        if (planMatch) {
          try {
            const parsed = JSON.parse(planMatch[1]);
            if (parsed.plan && Array.isArray(parsed.plan)) {
              const steps: AgentPlanStep[] = parsed.plan.map((s: { title?: string; description?: string }) => ({
                title: s.title ?? 'Step',
                description: s.description ?? '',
                status: 'pending' as const,
              }));
              setPlan(steps);
              setPhase('plan_ready');
              await updateAgentSession(session.id, {
                status: 'awaiting_approval',
                plan: steps,
              });
              onSessionUpdated?.({ ...session, status: 'awaiting_approval', plan: steps });
            }
          } catch {
            // not a valid plan JSON — continue as normal conversation
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Generation failed.';
        const aborted = msg.toLowerCase().includes('abort');
        if (!aborted) toast.error('The agent encountered an error.', msg);
      } finally {
        setStreaming(false);
        setStreamingContent('');
        abortRef.current = null;
      }
    },
    [session, model, preferences, agent, toast, onSessionUpdated],
  );

  const onSend = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || streaming || !session?.chat_id) return;

      setInput('');
      const userMsg = await addAgentMessage(session.chat_id, 'user', content);
      const history = [...messages, userMsg];
      setMessages(history);
      await runStream(history, content);
    },
    [input, streaming, session, messages, runStream],
  );

  // Approve the plan and start building.
  const onApprovePlan = useCallback(async () => {
    if (!session || !plan) return;
    setPhase('building');
    const updated = { ...session, status: 'building' as const, current_step: 0 };
    setSession(updated);
    await updateAgentSession(session.id, { status: 'building', current_step: 0 });
    onSessionUpdated?.(updated);

    // Mark first step as in_progress.
    const newPlan = plan.map((s, i) => ({ ...s, status: i === 0 ? 'in_progress' as const : 'pending' as const }));
    setPlan(newPlan);
    await updateAgentSession(session.id, { plan: newPlan });

    // Tell the agent to start building step 1.
    const stepMsg = `The user approved the plan. Start working on step 1: "${newPlan[0].title}". ${newPlan[0].description}. Show your work and output.`;
    const userMsg = await addAgentMessage(session.chat_id, 'user', stepMsg);
    const history = [...messages, userMsg];
    setMessages(history);
    await runStream(history, stepMsg);
  }, [session, plan, messages, runStream, onSessionUpdated]);

  // Reject the plan — go back to asking mode.
  const onRejectPlan = useCallback(async () => {
    if (!session) return;
    setPhase('asking');
    setPlan(null);
    await updateAgentSession(session.id, { status: 'planning', plan: null });
    onSessionUpdated?.({ ...session, status: 'planning', plan: null });
    const userMsg = await addAgentMessage(session.chat_id, 'user', 'Please revise the plan. I have feedback.');
    const history = [...messages, userMsg];
    setMessages(history);
    await runStream(history, 'Please revise the plan.');
  }, [session, messages, runStream, onSessionUpdated]);

  // Pause / resume.
  const onPause = useCallback(async () => {
    if (!session) return;
    abortRef.current?.abort();
    setPhase('paused');
    const updated = { ...session, status: 'paused' as const };
    setSession(updated);
    await updateAgentSession(session.id, { status: 'paused' });
    onSessionUpdated?.(updated);
  }, [session, onSessionUpdated]);

  const onResume = useCallback(async () => {
    if (!session || !plan) return;
    setPhase('building');
    const updated = { ...session, status: 'building' as const };
    setSession(updated);
    await updateAgentSession(session.id, { status: 'building' });
    onSessionUpdated?.(updated);

    const currentStep = plan.find((s) => s.status === 'in_progress');
    if (currentStep) {
      const stepIdx = plan.indexOf(currentStep);
      const resumeMsg = `Resuming. Continue working on step ${stepIdx + 1}: "${currentStep.title}". ${currentStep.description}.`;
      const userMsg = await addAgentMessage(session.chat_id, 'user', resumeMsg);
      const history = [...messages, userMsg];
      setMessages(history);
      await runStream(history, resumeMsg);
    }
  }, [session, plan, messages, runStream, onSessionUpdated]);

  // Advance to the next step.
  const onAdvanceStep = useCallback(async () => {
    if (!session || !plan) return;
    const currentIdx = plan.findIndex((s) => s.status === 'in_progress');
    if (currentIdx === -1) return;

    const newPlan = plan.map((s, i) => {
      if (i === currentIdx) return { ...s, status: 'done' as const };
      if (i === currentIdx + 1) return { ...s, status: 'in_progress' as const };
      return s;
    });
    setPlan(newPlan);
    await updateAgentSession(session.id, { plan: newPlan, current_step: currentIdx + 1 });

    if (currentIdx + 1 >= plan.length) {
      // All done.
      setPhase('done');
      const updated = { ...session, status: 'completed' as const };
      setSession(updated);
      await updateAgentSession(session.id, { status: 'completed' });
      onSessionUpdated?.(updated);
      const doneMsg = await addAgentMessage(session.chat_id, 'assistant', 'All steps are complete! Your project is ready. Let me know if you need any revisions.');
      setMessages((prev) => [...prev, doneMsg]);
    } else {
      const nextStep = newPlan[currentIdx + 1];
      const stepMsg = `Step ${currentIdx + 2}: "${nextStep.title}". ${nextStep.description}. Show your work and output.`;
      const userMsg = await addAgentMessage(session.chat_id, 'user', stepMsg);
      const history = [...messages, userMsg];
      setMessages(history);
      await runStream(history, stepMsg);
    }
  }, [session, plan, messages, runStream, onSessionUpdated]);

  // Save edited plan.
  const onSaveEditedPlan = useCallback(async () => {
    if (!session) return;
    try {
      const lines = editedPlan.split('\n').filter((l) => l.trim());
      const newPlan: AgentPlanStep[] = lines.map((line) => {
        const cleaned = line.replace(/^\d+\.\s*/, '').trim();
        return { title: cleaned, description: '', status: 'pending' as const };
      });
      setPlan(newPlan);
      setEditingPlan(false);
      await updateAgentSession(session.id, { plan: newPlan });
      onSessionUpdated?.({ ...session, plan: newPlan });
      toast.success('Plan updated.');
    } catch {
      toast.error('Could not save plan.');
    }
  }, [session, editedPlan, onSessionUpdated, toast]);

  function startEditPlan() {
    if (!plan) return;
    setEditedPlan(plan.map((s, i) => `${i + 1}. ${s.title}`).join('\n'));
    setEditingPlan(true);
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-white dark:bg-surface-dark">
      <Seo title={agent.name} path="/app/agents" />

      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-surface-border px-3 backdrop-blur-md sm:px-4 dark:border-surface-dark-border">
        <button
          onClick={onBack}
          className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-surface-dark-muted"
          aria-label="Back to agents"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className={clsx('grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-white', agent.gradient)}>
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{agent.name}</h1>
          <p className="truncate text-[11px] text-slate-400">
            {phase === 'asking' && 'Understanding your project…'}
            {phase === 'plan_ready' && 'Plan ready for review'}
            {phase === 'building' && 'Building step by step…'}
            {phase === 'paused' && 'Paused'}
            {phase === 'done' && 'Completed'}
          </p>
        </div>

        <ModelSelector
          value={model}
          onChange={(id) => {
            setModel(id);
            if (session) {
              const opt = getModel(id);
              updateAgentSession(session.id, { model: id, provider: (opt?.provider ?? 'groq') as Provider });
            }
          }}
          compact
        />
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Main conversation */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
              </div>
            ) : (
              <div className="mx-auto max-w-3xl pb-6">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={clsx(
                      'flex gap-3 px-4 py-5 sm:px-6',
                      m.role === 'user' ? 'bg-transparent' : 'bg-slate-50/60 dark:bg-surface-dark-muted/40',
                    )}
                  >
                    {m.role === 'assistant' ? (
                      <span className={clsx('grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br text-white shadow-glow', agent.gradient)}>
                        <Icon className="h-4 w-4" />
                      </span>
                    ) : (
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-600 dark:bg-surface-dark-border dark:text-slate-300">
                        <span className="text-xs font-bold">You</span>
                      </span>
                    )}
                    <div className="prose-chat min-w-0 flex-1 text-slate-700 dark:text-slate-200">
                      <ReactMarkdownSync content={m.content} />
                    </div>
                  </div>
                ))}

                {streaming && (
                  <div className="flex gap-3 px-4 py-5 sm:px-6 bg-slate-50/60 dark:bg-surface-dark-muted/40">
                    <span className={clsx('grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br text-white shadow-glow', agent.gradient)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="prose-chat stream-caret min-w-0 flex-1 text-slate-700 dark:text-slate-200">
                      {streamingContent ? (
                        <ReactMarkdownSync content={streamingContent} />
                      ) : (
                        <span className="flex items-center gap-2 text-sm text-slate-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Thinking…
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="shrink-0 border-t border-surface-border p-3 sm:p-4 dark:border-surface-dark-border">
            {phase === 'building' && (
              <div className="mb-2 flex items-center justify-center gap-2">
                <Button variant="ghost" size="sm" onClick={onPause} leftIcon={<Pause className="h-3.5 w-3.5" />}>
                  Pause
                </Button>
                <Button variant="ghost" size="sm" onClick={onAdvanceStep} leftIcon={<Check className="h-3.5 w-3.5" />}>
                  Mark step done & continue
                </Button>
              </div>
            )}
            {phase === 'paused' && (
              <div className="mb-2 flex items-center justify-center">
                <Button variant="primary" size="sm" onClick={onResume} leftIcon={<Play className="h-3.5 w-3.5" />}>
                  Resume
                </Button>
              </div>
            )}

            <div className="flex items-end gap-2 rounded-2xl border border-surface-border bg-white p-2 shadow-sm focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-surface-dark-border dark:bg-surface-dark-elevated">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
                placeholder="Reply to the agent…"
                rows={1}
                className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
                disabled={streaming || phase === 'done'}
              />
              {streaming ? (
                <button
                  onClick={() => abortRef.current?.abort()}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-error-500 text-white transition-colors hover:bg-error-600"
                  aria-label="Stop"
                >
                  <Square className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => onSend()}
                  disabled={!input.trim() || phase === 'done'}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-glow transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Plan sidebar — shown when a plan exists */}
        {plan && (
          <aside className="hidden w-72 shrink-0 border-l border-surface-border bg-surface-subtle/50 p-4 overflow-y-auto lg:block dark:border-surface-dark-border dark:bg-surface-dark-muted/30">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Project Plan</h3>
              {phase === 'plan_ready' && !editingPlan && (
                <button
                  onClick={startEditPlan}
                  className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400"
                >
                  <Edit3 className="h-3 w-3" />
                  Edit
                </button>
              )}
            </div>

            {editingPlan ? (
              <div className="mb-3">
                <textarea
                  value={editedPlan}
                  onChange={(e) => setEditedPlan(e.target.value)}
                  rows={8}
                  className="w-full rounded-lg border border-surface-border bg-white p-2 text-xs text-slate-700 focus:border-brand-400 focus:outline-none dark:border-surface-dark-border dark:bg-surface-dark-elevated dark:text-slate-200"
                />
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={onSaveEditedPlan} leftIcon={<Check className="h-3 w-3" />}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingPlan(false)} leftIcon={<X className="h-3 w-3" />}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            {!editingPlan && (
              <ol className="space-y-2">
                {plan.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 rounded-lg p-2 transition-colors">
                    <PlanStepIcon status={step.status} />
                    <div className="min-w-0">
                      <p
                        className={clsx(
                          'text-xs font-medium',
                          step.status === 'done'
                            ? 'text-slate-400 line-through'
                            : step.status === 'in_progress'
                              ? 'text-brand-600 dark:text-brand-300'
                              : 'text-slate-600 dark:text-slate-300',
                        )}
                      >
                        {i + 1}. {step.title}
                      </p>
                      {step.description && (
                        <p className="mt-0.5 text-[11px] text-slate-400">{step.description}</p>
                      )}
                      {step.status === 'in_progress' && (
                        <p className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-brand-500">
                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          In progress
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {/* Approval buttons */}
            {phase === 'plan_ready' && !editingPlan && (
              <div className="mt-4 space-y-2">
                <Button className="w-full" onClick={onApprovePlan} leftIcon={<Check className="h-4 w-4" />}>
                  Approve & start building
                </Button>
                <Button variant="ghost" className="w-full" onClick={onRejectPlan} leftIcon={<X className="h-4 w-4" />}>
                  Request changes
                </Button>
              </div>
            )}

            {phase === 'building' && (
              <div className="mt-4 rounded-lg bg-brand-50 p-3 dark:bg-brand-900/20">
                <p className="text-xs text-brand-700 dark:text-brand-300">
                  {plan.filter((s) => s.status === 'done').length} of {plan.length} steps complete
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-100 dark:bg-brand-900/40">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-500"
                    style={{
                      width: `${(plan.filter((s) => s.status === 'done').length / plan.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {phase === 'done' && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-success-50 p-3 dark:bg-success-900/20">
                <CheckCircle2 className="h-4 w-4 text-success-600" />
                <p className="text-xs font-medium text-success-700 dark:text-success-400">Project completed</p>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function PlanStepIcon({ status }: { status: AgentPlanStep['status'] }) {
  if (status === 'done')
    return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-500" />;
  if (status === 'in_progress')
    return <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />;
  if (status === 'skipped')
    return <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />;
  return <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />;
}

// Markdown renderer wrapper (kept local to avoid extra import churn).
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
function ReactMarkdownSync({ content }: { content: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>;
}

const PLAN_FORMAT_INSTRUCTION = `

When you have gathered enough information to create a plan, respond with a brief explanation and then include a JSON code block with your plan in this exact format:
\`\`\`json
{
  "plan": [
    { "title": "Step 1 title", "description": "What will be done in this step" },
    { "title": "Step 2 title", "description": "What will be done in this step" }
  ]
}
\`\`\`
After presenting the plan, ask the user if they approve it or want changes. Do not start building until the user approves.`;
