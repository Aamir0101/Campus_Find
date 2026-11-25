import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, UserPlus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { InputField, SelectField } from '../../components/ui/FormControls';
import { useRegisterMutation } from '../../hooks/useCampusFindQueries';
import type { UserProfile } from '../../types/domain';
import { validateRegistrationForm, type ValidationErrors } from '../../utils/validators';

const DEPARTMENTS = [
  'Computer Science & Engineering',
  'Mathematics & Physical Sciences',
  'Economics & Business',
  'Architecture & Urban Design',
  'Biological Sciences',
  'Humanities & Social Sciences',
];

export function RegisterPage() {
  const registerMutation = useRegisterMutation();

  const [formState, setFormState] = useState({
    fullName: '',
    email: '',
    campusId: '',
    department: DEPARTMENTS[0],
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<ValidationErrors<string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [registeredUser, setRegisteredUser] = useState<UserProfile | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setApiError(null);

    const validationErrors = validateRegistrationForm(formState);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    try {
      const user = await registerMutation.mutateAsync({
        fullName: formState.fullName.trim(),
        email: formState.email.trim(),
        campusId: formState.campusId.trim(),
        department: formState.department,
        password: formState.password,
      });
      setRegisteredUser(user);
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : 'Registration failed. Check your university details and try again.',
      );
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-lg border border-[#E2E8F0] bg-white p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {registeredUser ? (
          <div className="space-y-5 py-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-[#16A34A]" aria-hidden="true" />
              <div className="space-y-1.5">
                <h1 className="text-xl font-semibold text-[#0F172A]">
                  Student Account Created
                </h1>
                <p className="text-sm text-[#475569]">
                  Welcome, <span className="font-medium text-[#0F172A]">{registeredUser.fullName}</span> ({registeredUser.email}). Your student session is now active.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-[#E2E8F0] pt-5">
              <Link to="/student">
                <Button>Open Student Portal</Button>
              </Link>
              <Link to="/student/report-lost">
                <Button variant="outline">Report a Lost Item</Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="flex items-start gap-3 border-b border-[#E2E8F0] pb-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#E2E8F0] bg-[#F8FAFC] text-[#1E40AF]">
                <UserPlus className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">
                  Student Account Registration
                </h1>
                <p className="mt-1 text-xs text-[#64748B]">
                  Requires an approved university email domain and your Campus ID.
                </p>
              </div>
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InputField
                id="reg-name"
                label="Full Name"
                required
                placeholder="Maya Lin"
                value={formState.fullName}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, fullName: e.target.value }))
                }
                error={errors.fullName}
              />

              <InputField
                id="reg-campus-id"
                label="Campus ID Number"
                required
                placeholder="STU-48291"
                value={formState.campusId}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, campusId: e.target.value }))
                }
                error={errors.campusId}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InputField
                id="reg-email"
                label="University Email"
                type="email"
                required
                placeholder="name@university.edu"
                value={formState.email}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, email: e.target.value }))
                }
                error={errors.email}
              />

              <SelectField
                id="reg-dept"
                label="Department / Affiliation"
                required
                value={formState.department}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, department: e.target.value }))
                }
                error={errors.department}
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </SelectField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InputField
                id="reg-password"
                label="Password"
                type="password"
                required
                placeholder="Min 8 chars, upper/lower/number"
                value={formState.password}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, password: e.target.value }))
                }
                error={errors.password}
              />

              <InputField
                id="reg-confirm"
                label="Confirm Password"
                type="password"
                required
                placeholder="Re-enter password"
                value={formState.confirmPassword}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, confirmPassword: e.target.value }))
                }
                error={errors.confirmPassword}
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? 'Creating Account...' : 'Create Student Account'}
              </Button>
            </div>

            <p className="text-center text-xs text-[#64748B]">
              Already registered?{' '}
              <Link to="/login" className="font-medium text-[#1E40AF] hover:underline">
                Sign in here
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
