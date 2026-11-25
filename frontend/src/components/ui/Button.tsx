import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[#1E40AF] text-white border border-[#1E40AF] hover:bg-[#1D4ED8] active:bg-[#1E3A8A] shadow-[0_1px_2px_rgba(15,23,42,0.06)]',
  secondary:
    'bg-[#0F172A] text-white border border-[#0F172A] hover:bg-[#1E293B] shadow-[0_1px_2px_rgba(15,23,42,0.06)]',
  outline:
    'bg-white text-[#0F172A] border border-[#CBD5E1] hover:bg-[#F8FAFC] hover:border-[#94A3B8]',
  ghost:
    'bg-transparent text-[#334155] border border-transparent hover:bg-[#F1F5F9] hover:text-[#0F172A]',
  danger:
    'bg-[#DC2626] text-white border border-[#DC2626] hover:bg-[#B91C1C]',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[38px] px-3.5 py-1.5 text-xs',
  md: 'min-h-[42px] px-4 py-2 text-sm',
  lg: 'min-h-[46px] px-5 py-2.5 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E40AF] disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
