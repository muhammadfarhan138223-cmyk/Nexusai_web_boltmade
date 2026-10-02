import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Github } from 'lucide-react';
import { Seo } from '@/components/ui/Seo';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { AuthParticles } from '@/components/auth/AuthParticles';
import './auth.css';

interface AuthFormProps {
  mode: 'login' | 'signup';
  onSwitch: (mode: 'login' | 'signup') => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthForm({
  mode,
  onSwitch,
}: AuthFormProps) {
  const {
    signIn,
    signUp,
    signInWithProvider,
    resetPassword,
  } = useAuth();

  const toast = useToast();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [remember, setRemember] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  const [loading, setLoading] = useState(false);

  const [oauthLoading, setOauthLoading] =
    useState<
      'google' | 'github' | 'facebook' | null
    >(null);

  const [showPassword, setShowPassword] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const isSignup = mode === 'signup';

  const passwordStrength = (() => {
    let score = 0;

    if (password.length > 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    return score;
  })();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    setError(null);
    setMessage(null);

    if (!EMAIL_RE.test(email)) {
      setError(
        'Please enter a valid email address.'
      );
      return;
    }

    if (
      !resetMode &&
      password.length < 6
    ) {
      setError(
        'Password must be at least 6 characters.'
      );
      return;
    }

    if (
      isSignup &&
      fullName.trim().length < 1
    ) {
      setError('Please enter your name.');
      return;
    }

    setLoading(true);

    try {
      if (resetMode) {
        const { error: err } =
          await resetPassword(email);

        if (err) {
          setError(err);
        } else {
          setMessage(
            'Password reset email sent. Check your inbox.'
          );
        }

        return;
      }

      if (isSignup) {
        const result = await signUp(
          email,
          password,
          fullName.trim()
        );

        if (result.error) {
          setError(result.error);
        } else if (
          result.needsEmailConfirmation
        ) {
          setMessage(
            'Account created. Check your email to confirm your account, then sign in.'
          );
        } else {
          toast.success(
            'Welcome to Nexus AI!',
            'Your account is ready.'
          );
        }
      } else {
        const { error: err } =
          await signIn(
            email,
            password
          );

        if (err) {
          setError(err);
        } else {
          toast.success(
            'Welcome back!'
          );
        }
      }
    } catch {
      setError(
        'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(
    provider:
      | 'google'
      | 'github'
      | 'facebook'
  ) {
    setError(null);
    setMessage(null);

    setOauthLoading(provider);

    const { error: err } =
      await signInWithProvider(provider);

    if (err) {
      setError(err);
      setOauthLoading(null);
    }
  }

  const title = resetMode
    ? 'Reset Password'
    : isSignup
      ? 'Create Account'
      : 'Welcome Back';

  const providerLabel =
    oauthLoading === 'google'
      ? 'Google'
      : oauthLoading === 'github'
        ? 'GitHub'
        : 'Facebook';

  return (
    <div className="nexus-auth">
      <Seo
        title={title}
        path={
          isSignup
            ? '/signup'
            : '/login'
        }
      />

      <AuthParticles />

      <header className="nexus-auth-header">
        <button
          className="nexus-auth-logo"
          type="button"
          onClick={() =>
            (window.location.href = '/')
          }
        >
          <span className="nexus-auth-logo-title">
            NEXUS AI
          </span>

          <span className="nexus-auth-logo-subtitle">
            Intelligence, connected.
          </span>
        </button>

        <nav
          className="nexus-auth-nav"
          aria-label="Authentication navigation"
        >
          <button
            type="button"
            onClick={() => {
              setResetMode(false);
              onSwitch('login');
            }}
          >
            Login
          </button>

          <button
            type="button"
            onClick={() => {
              setResetMode(false);
              onSwitch('signup');
            }}
          >
            Register
          </button>
        </nav>
      </header>

      <main className="nexus-auth-main">
        <section className="nexus-auth-card">
          <div>
            <h1 className="nexus-auth-title">
              {title}
            </h1>

            <p className="nexus-auth-tagline">
              {resetMode
                ? 'Enter your email and we will send you a secure reset link.'
                : 'Secure access, intelligent experience.'}
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            className="nexus-auth-form"
          >
            {isSignup &&
              !resetMode && (
                <FloatingLabel
                  label="Full Name"
                  name="name"
                  value={fullName}
                  onChange={(e) =>
                    setFullName(
                      e.target.value
                    )
                  }
                />
              )}

            <FloatingLabel
              label="Email"
              type="email"
              name="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
            />

            {!resetMode && (
              <>
                <FloatingLabel
                  label="Password"
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  name="password"
                  value={password}
                  onChange={(e) =>
                    setPassword(
                      e.target.value
                    )
                  }
                  rightAction={
                    <button
                      type="button"
                      className="nexus-password-toggle"
                      onClick={() =>
                        setShowPassword(
                          (value) => !value
                        )
                      }
                      aria-label={
                        showPassword
                          ? 'Hide password'
                          : 'Show password'
                      }
                    >
                      {showPassword ? (
                        <EyeOff size={19} />
                      ) : (
                        <Eye size={19} />
                      )}
                    </button>
                  }
                />

                {isSignup && (
                  <div className="nexus-auth-strength">
                    <span
                      style={{
                        width: `${
                          (passwordStrength / 4) *
                          100
                        }%`,
                        background:
                          [
                            '#ff4d4d',
                            '#ffae00',
                            '#a0e600',
                            '#00ffae',
                            '#00ffff',
                          ][passwordStrength],
                      }}
                    />
                  </div>
                )}
              </>
            )}

            {!resetMode &&
              !isSignup && (
                <div className="nexus-auth-extra">
                  <label>
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) =>
                        setRemember(
                          e.target.checked
                        )
                      }
                    />

                    Remember me
                  </label>

                  <button
                    type="button"
                    className="nexus-auth-link"
                    onClick={() => {
                      setResetMode(true);
                      setError(null);
                      setMessage(null);
                    }}
                  >
                    Forgot?
                  </button>
                </div>
              )}

            {error && (
              <div className="nexus-auth-error">
                {error}
              </div>
            )}

            {message && (
              <div className="nexus-auth-success">
                {message}
              </div>
            )}

            <button
              type="submit"
              className="nexus-auth-cta"
              disabled={loading}
            >
              {loading
                ? 'Please wait…'
                : resetMode
                  ? 'Send Reset Link'
                  : isSignup
                    ? 'Create Account'
                    : 'Sign In'}
            </button>
          </form>

          {!resetMode && (
            <div className="nexus-auth-social">
              <p>
                Or continue with
              </p>

              <div className="nexus-auth-social-row">
                <button
                  type="button"
                  className="nexus-auth-social-btn nexus-auth-provider-google"
                  aria-label="Continue with Google"
                  title="Continue with Google"
                  disabled={
                    oauthLoading !== null
                  }
                  onClick={() =>
                    handleOAuth('google')
                  }
                >
                  <span className="nexus-provider-letter">
                    G
                  </span>
                </button>

                <button
                  type="button"
                  className="nexus-auth-social-btn"
                  aria-label="Continue with GitHub"
                  title="Continue with GitHub"
                  disabled={
                    oauthLoading !== null
                  }
                  onClick={() =>
                    handleOAuth('github')
                  }
                >
                  <Github size={20} />
                </button>

                <button
                  type="button"
                  className="nexus-auth-social-btn nexus-auth-provider-facebook"
                  aria-label="Continue with Facebook"
                  title="Continue with Facebook"
                  disabled={
                    oauthLoading !== null
                  }
                  onClick={() =>
                    handleOAuth('facebook')
                  }
                >
                  <span className="nexus-provider-letter">
                    f
                  </span>
                </button>
              </div>

              {oauthLoading && (
                <p style={{ marginTop: 10 }}>
                  Opening {providerLabel}…
                </p>
              )}
            </div>
          )}

          <p className="nexus-auth-switch">
            {resetMode ? (
              <>
                Remember your password?{' '}

                <button
                  type="button"
                  onClick={() =>
                    setResetMode(false)
                  }
                >
                  Back to login
                </button>
              </>
            ) : (
              <>
                {isSignup
                  ? 'Already have an account?'
                  : "Don't have an account?"}{' '}

                <button
                  type="button"
                  onClick={() =>
                    onSwitch(
                      isSignup
                        ? 'login'
                        : 'signup'
                    )
                  }
                >
                  {isSignup
                    ? 'Sign in'
                    : 'Sign up'}
                </button>
              </>
            )}
          </p>
        </section>
      </main>

      <footer className="nexus-auth-footer">
        NEXUS AI · Secure authentication
      </footer>
    </div>
  );
}

function FloatingLabel({
  label,
  type = 'text',
  value,
  onChange,
  name,
  rightAction,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
  name: string;
  rightAction?: React.ReactNode;
}) {
  return (
    <div className="nexus-floating">
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder=" "
        required
        autoComplete={
          name === 'password'
            ? 'current-password'
            : name === 'name'
              ? 'name'
              : 'email'
        }
      />

      <label htmlFor={name}>
        {label}
      </label>

      {rightAction && (
        <div className="nexus-floating-action">
          {rightAction}
        </div>
      )}
    </div>
  );
}
