import { useState } from 'react';
import {
  BookOpen,
  Briefcase,
  CreditCard,
  KeyRound,
  Laptop,
  Package,
  Shirt,
  Wallet,
  Watch,
} from 'lucide-react';
import type { ItemCategory } from '../../types/domain';

interface ImageWithFallbackProps {
  src?: string;
  alt: string;
  category?: ItemCategory;
  className?: string;
}

function getCategoryIcon(category?: ItemCategory) {
  switch (category) {
    case 'Electronics':
      return Laptop;
    case 'ID Cards':
      return CreditCard;
    case 'Wallets':
      return Wallet;
    case 'Bags':
      return Briefcase;
    case 'Books':
      return BookOpen;
    case 'Clothing':
      return Shirt;
    case 'Accessories':
      return Watch;
    case 'Keys':
      return KeyRound;
    default:
      return Package;
  }
}

export function ImageWithFallback({
  src,
  alt,
  category,
  className = 'h-full w-full object-cover',
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);
  const Icon = getCategoryIcon(category);

  if (!src || hasError) {
    return (
      <div
        role="img"
        aria-label={alt}
        className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#F1F5F9] px-4 text-center text-[#64748B]"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-md border border-[#E2E8F0] bg-white text-[#1E40AF]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <span className="text-xs font-medium text-[#475569]">
          {category ?? 'Campus Property'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
}
