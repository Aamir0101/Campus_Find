import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface BaseFieldProps {
  label: string;
  id: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

type InputFieldProps = BaseFieldProps & InputHTMLAttributes<HTMLInputElement>;
type SelectFieldProps = BaseFieldProps & SelectHTMLAttributes<HTMLSelectElement>;
type TextareaFieldProps = BaseFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

const BASE_INPUT_STYLE =
  'w-full rounded-md border bg-white px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/20 focus:border-[#1E40AF]';

export function InputField({
  label,
  id,
  error,
  hint,
  required,
  className = '',
  ...props
}: InputFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-[#0F172A]">
        {label}
        {required && <span className="ml-1 text-[#DC2626]" aria-hidden="true">*</span>}
      </label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${BASE_INPUT_STYLE} min-h-[42px] ${
          error ? 'border-[#DC2626]' : 'border-[#CBD5E1]'
        } ${className}`}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-[#DC2626]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-[#64748B]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  id,
  error,
  hint,
  required,
  className = '',
  children,
  ...props
}: SelectFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-[#0F172A]">
        {label}
        {required && <span className="ml-1 text-[#DC2626]" aria-hidden="true">*</span>}
      </label>
      <select
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${BASE_INPUT_STYLE} min-h-[42px] ${
          error ? 'border-[#DC2626]' : 'border-[#CBD5E1]'
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-[#DC2626]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-[#64748B]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextareaField({
  label,
  id,
  error,
  hint,
  required,
  className = '',
  ...props
}: TextareaFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-[#0F172A]">
        {label}
        {required && <span className="ml-1 text-[#DC2626]" aria-hidden="true">*</span>}
      </label>
      <textarea
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${BASE_INPUT_STYLE} ${
          error ? 'border-[#DC2626]' : 'border-[#CBD5E1]'
        } ${className}`}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-[#DC2626]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-[#64748B]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
