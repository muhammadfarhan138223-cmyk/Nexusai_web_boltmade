// src/lib/localAuth.ts
// Local, browser-only authentication.
//
// There is no backend/database anymore — accounts, passwords (hashed) and
// sessions all live in this browser's localStorage. That means:
//   - Each browser/device has its own separate set of accounts.
//   - Clearing site data / localStorage wipes accounts and all chat history.
//   - This is NOT secure enough for real user data — it's meant for a
//     personal/demo deployment where "login" just separates local profiles.

const USERS_KEY = 'nexus-local-users';
const SESSION_KEY = 'nexus-local-session';

export interface LocalUser {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  createdAt: string;
}

interface StoredSession {
  userId: string;
}

function readUsers(): LocalUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveUsers(users: LocalUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function getSession(): StoredSession | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

function setSession(session: StoredSession | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

export function getUserById(id: string): LocalUser | null {
  return readUsers().find((u) => u.id === id) ?? null;
}

export async function localSignUp(
  email: string,
  password: string,
  fullName: string,
): Promise<{ user: LocalUser | null; error: string | null }> {
  const normalizedEmail = email.trim().toLowerCase();
  const users = readUsers();

  if (users.some((u) => u.email === normalizedEmail)) {
    return { user: null, error: 'An account with this email already exists on this browser.' };
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password, id);

  const user: LocalUser = {
    id,
    email: normalizedEmail,
    passwordHash,
    fullName,
    createdAt: new Date().toISOString(),
  };

  saveUsers([...users, user]);
  setSession({ userId: user.id });

  return { user, error: null };
}

export async function localSignIn(
  email: string,
  password: string,
): Promise<{ user: LocalUser | null; error: string | null }> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = readUsers().find((u) => u.email === normalizedEmail);

  if (!user) {
    return { user: null, error: 'No account found with this email on this browser.' };
  }

  const hash = await hashPassword(password, user.id);
  if (hash !== user.passwordHash) {
    return { user: null, error: 'Incorrect password.' };
  }

  setSession({ userId: user.id });
  return { user, error: null };
}

export function localSignOut(): void {
  setSession(null);
}

export function updateLocalUser(id: string, updates: Partial<Pick<LocalUser, 'fullName'>>): LocalUser | null {
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...updates };
  saveUsers(users);
  return users[idx];
}

export function getCurrentUser(): LocalUser | null {
  const session = getSession();
  if (!session) return null;
  return getUserById(session.userId);
}
