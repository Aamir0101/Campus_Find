import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, subtitle, children }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/45 p-4"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-[#E2E8F0] px-6 py-4">
          <div>
            <h2 id="modal-title" className="text-lg font-semibold text-[#0F172A]">
              {title}
            </h2>
            {subtitle ? <p className="mt-0.5 text-xs text-[#64748B]">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-9 w-9 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] focus-visible:outline-2 focus-visible:outline-[#1E40AF] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-[78vh] overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
