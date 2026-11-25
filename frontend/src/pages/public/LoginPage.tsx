import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { InputField } from '../../components/ui/FormControls';
import { useLoginMutation } from '../../hooks/useCampusFindQueries';
import { validateLoginForm, type ValidationErrors } from '../../utils/validators';

export function LoginPage() {
  const navigate = useNavigate();
  const loginMutation = useLoginMutation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<ValidationErrors<'email' | 'password'>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setApiError(null);

    const validationErrors = validateLoginForm({ email, password });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    try {
      const user = await loginMutation.mutateAsync({
        email: email.trim(),
        password,
      });
      navigate(user.role === 'ADMIN' || user.role === 'STAFF' ? '/admin' : '/student');
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : 'Unable to sign in. Verify your credentials and try again.',
      );
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-140px)] max-w-5xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid w-full grid-cols-1 overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:grid-cols-12">
        <div className="flex flex-col justify-between border-b border-[#E2E8F0] bg-[#0F172A] p-8 text-white lg:col-span-5 lg:border-b-0 lg:border-r">
          <div className="space-y-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#1E40AF] text-white">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Sign in to CampusFind
            </h1>
            <p className="text-sm leading-relaxed text-[#CBD5E1]">
              Access your university lost and found workspace to submit property reports, upload photographs, and manage active records.
            </p>
          </div>

          <div className="mt-8 rounded-md border border-[#1E293B] bg-[#1E293B]/70 p-4 text-xs leading-relaxed text-[#CBD5E1]">
            <p className="font-semibold text-white">Session Security</p>
            <p className="mt-1">
              Authentication uses HttpOnly signed session cookies and university domain verification.
            </p>
          </div>
        </div>

        <div className="p-8 sm:p-10 lg:col-span-7">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-[#0F172A]">Account Credentials</h2>
              <p className="text-xs text-[#64748B]">
                Sign in with your verified university email address.
              </p>
            </div>

            {apiError ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-md border border-[#FECACA] bg-[#FEF2F2] p-3 text-xs text-[#991B1B]"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC2626]" aria-hidden="true" />
                <span>{apiError}</span>
              </div>
            ) : null}

            <InputField
              id="login-email"
              label="University Email"
              type="email"
              required
              autoComplete="email"
              placeholder="name@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />

            <InputField
              id="login-password"
              label="Password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
            />

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? 'Signing In...' : 'Sign In'}
            </Button>

            <p className="text-center text-xs text-[#64748B]">
              New to CampusFind?{' '}
              <Link
                to="/register"
                className="font-medium text-[#1E40AF] hover:underline"
              >
                Register with your Campus ID
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
