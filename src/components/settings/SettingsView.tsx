// src/components/settings/SettingsView.tsx
import { useState } from 'react';
import { ArrowLeft, User as UserIcon, Sliders, Palette, Save, Sun, Moon, Monitor, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { ModelSelector } from '@/components/ui/ModelSelector';
import { Seo } from '@/components/ui/Seo';
import { useAuth, saveLocalProfile, saveLocalPreferences } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { clamp } from '@/lib/utils';
import { clsx } from '@/lib/clsx';
import type { Provider, UserPreferences } from '@/lib/database.types';

interface SettingsViewProps {
  onBack: () => void;
}

type Tab = 'profile' | 'preferences' | 'appearance';

export function SettingsView({ onBack }: SettingsViewProps) {
  const { user, profile, preferences, refreshProfile, refreshPreferences } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('profile');

  return (
    <div className="flex h-full flex-col bg-surface-subtle dark:bg-surface-dark">
      <Seo title="Settings" path="/app/settings" />
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-surface-border bg-white/80 px-4 backdrop-blur-md dark:border-surface-dark-border dark:bg-surface-dark/80">
        <button
          onClick={onBack}
          className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-surface-dark-muted"
          aria-label="Back to chat"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100">Settings</h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Tabs */}
        <nav className="hidden w-52 shrink-0 border-r border-surface-border p-3 sm:block dark:border-surface-dark-border">
          <TabBtn active={tab === 'profile'} onClick={() => setTab('profile')} icon={UserIcon} label="Profile" />
          <TabBtn active={tab === 'preferences'} onClick={() => setTab('preferences')} icon={Sliders} label="AI preferences" />
          <TabBtn active={tab === 'appearance'} onClick={() => setTab('appearance')} icon={Palette} label="Appearance" />
        </nav>

        {/* Mobile tab bar */}
        <div className="absolute -mt-px flex w-full gap-1 border-b border-surface-border bg-white px-2 py-1.5 sm:hidden dark:border-surface-dark-border dark:bg-surface-dark">
          <MobileTab active={tab === 'profile'} onClick={() => setTab('profile')}>Profile</MobileTab>
          <MobileTab active={tab === 'preferences'} onClick={() => setTab('preferences')}>AI</MobileTab>
          <MobileTab active={tab === 'appearance'} onClick={() => setTab('appearance')}>Theme</MobileTab>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pt-14 sm:p-8 sm:pt-8">
          <div className="mx-auto max-w-2xl">
            {tab === 'profile' && (
              <ProfileSection
                userId={user?.id ?? ''}
                email={user?.email ?? ''}
                profile={profile}
                onSaved={async () => {
                  await refreshProfile();
                  toast.success('Profile updated.');
                }}
              />
            )}
            {tab === 'preferences' && (
              <PreferencesSection
                userId={user?.id ?? ''}
                prefs={preferences}
                onSaved={async () => {
                  await refreshPreferences();
                  toast.success('AI preferences saved.');
                }}
              />
            )}
            {tab === 'appearance' && <AppearanceSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-dark-muted',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function MobileTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors',
        active ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200' : 'text-slate-500',
      )}
    >
      {children}
    </button>
  );
}

// ---------------- Profile ----------------

function ProfileSection({
  userId,
  email,
  profile,
  onSaved,
}: {
  userId: string;
  email: string;
  profile: { full_name: string | null; bio: string | null } | null;
  onSaved: () => Promise<void>;
}) {
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!userId) return;
    setSaving(true);
    try {
      saveLocalProfile(userId, { full_name: fullName.trim(), bio: bio.trim() });
      await onSaved();
    } catch (e) {
      console.error('profile save failed', e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Your profile" description="This appears on your messages and account.">
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={fullName || email} size={64} />
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{fullName || 'New user'}</p>
          <p className="text-sm text-slate-400">{email}</p>
        </div>
      </div>

      <Field label="Full name">
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="Your name" />
      </Field>
      <Field label="Bio" className="mt-4">
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          className={clsx(inputClass, 'resize-none')}
          placeholder="A short bio about you (optional)"
        />
      </Field>

      <div className="mt-6">
        <Button onClick={save} loading={saving} leftIcon={<Save className="h-4 w-4" />}>
          Save profile
        </Button>
      </div>
    </Section>
  );
}

// ---------------- Preferences ----------------

function PreferencesSection({
  userId,
  prefs,
  onSaved,
}: {
  userId: string;
  prefs: UserPreferences | null;
  onSaved: () => Promise<void>;
}) {
  const [model, setModel] = useState(prefs?.default_model ?? 'groq/openai/gpt-oss-120b');
  const [systemPrompt, setSystemPrompt] = useState(prefs?.system_prompt ?? '');
  const [temperature, setTemperature] = useState(prefs?.temperature ?? 0.7);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!userId) return;
    setSaving(true);
    try {
      const provider = model.split('/')[0] as Provider;
      saveLocalPreferences(userId, {
        default_provider: provider,
        default_model: model,
        system_prompt: systemPrompt.trim(),
        temperature,
        theme: prefs?.theme ?? 'system',
      });
      await onSaved();
    } catch {
      // eslint-disable-next-line no-console
      console.error('save prefs failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="AI preferences" description="Defaults applied to every new conversation.">
      <Field label="Default model">
        <ModelSelector value={model} onChange={setModel} />
      </Field>

      <Field label="System prompt" className="mt-6" hint="Optional. Defines the assistant's persona or instructions.">
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={4}
          className={clsx(inputClass, 'resize-none')}
          placeholder="e.g. You are a concise, friendly assistant who answers in plain language."
        />
      </Field>

      <Field label={`Creativity (temperature): ${temperature.toFixed(1)}`} className="mt-6" hint="Lower = focused & deterministic. Higher = creative & varied.">
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={temperature}
          onChange={(e) => setTemperature(clamp(parseFloat(e.target.value), 0, 1))}
          className="w-full accent-brand-500"
        />
        <div className="mt-1 flex justify-between text-xs text-slate-400">
          <span>Focused</span>
          <span>Balanced</span>
          <span>Creative</span>
        </div>
      </Field>

      <div className="mt-6">
        <Button onClick={save} loading={saving} leftIcon={<Save className="h-4 w-4" />}>
          Save preferences
        </Button>
      </div>
    </Section>
  );
}

// ---------------- Appearance ----------------

function AppearanceSection() {
  const { theme, setTheme, resolvedTheme, toggle } = useTheme();

  return (
    <Section title="Appearance" description="Choose how Nexus AI looks. System follows your device.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ThemeCard
          active={theme === 'light'}
          onClick={() => setTheme('light')}
          icon={Sun}
          label="Light"
          preview="light"
        />
        <ThemeCard
          active={theme === 'dark'}
          onClick={() => setTheme('dark')}
          icon={Moon}
          label="Dark"
          preview="dark"
        />
        <ThemeCard
          active={theme === 'system'}
          onClick={() => setTheme('system')}
          icon={Monitor}
          label="System"
          preview={resolvedTheme}
        />
      </div>

      <div className="mt-6 flex items-center justify-between rounded-xl border border-surface-border p-4 dark:border-surface-dark-border">
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Quick toggle</p>
          <p className="text-xs text-slate-400">Currently using {resolvedTheme} mode.</p>
        </div>
        <Button variant="outline" size="sm" onClick={toggle} leftIcon={resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}>
          Switch to {resolvedTheme === 'dark' ? 'light' : 'dark'}
        </Button>
      </div>
    </Section>
  );
}

function ThemeCard({
  active,
  onClick,
  icon: Icon,
  label,
  preview,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  preview: 'light' | 'dark';
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'group relative overflow-hidden rounded-2xl border p-3 text-left transition-all',
        active
          ? 'border-brand-400 ring-2 ring-brand-500/30'
          : 'border-surface-border hover:border-slate-300 dark:border-surface-dark-border dark:hover:border-slate-600',
      )}
    >
      <div
        className={clsx(
          'mb-3 h-16 rounded-lg border',
          preview === 'dark' ? 'bg-surface-dark border-surface-dark-border' : 'bg-white border-slate-200',
        )}
      >
        <div className="flex h-full items-center gap-1.5 p-2">
          <span className={clsx('h-2 w-2 rounded-full', preview === 'dark' ? 'bg-brand-400' : 'bg-brand-500')} />
          <span className={clsx('h-1.5 w-10 rounded', preview === 'dark' ? 'bg-slate-600' : 'bg-slate-200')} />
          <span className={clsx('h-1.5 w-6 rounded', preview === 'dark' ? 'bg-slate-700' : 'bg-slate-100')} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</span>
        {active && <Check className="ml-auto h-4 w-4 text-brand-600" />}
      </div>
    </button>
  );
}

// ---------------- shared bits ----------------

const inputClass =
  'w-full rounded-xl border border-surface-border bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-surface-dark-border dark:bg-surface-dark-muted dark:text-slate-100 dark:placeholder:text-slate-500';

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-fade-in">
      <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      <div className="mt-6 rounded-2xl border border-surface-border bg-white p-5 shadow-card dark:border-surface-dark-border dark:bg-surface-dark-elevated dark:shadow-card-dark sm:p-6">
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
    }
