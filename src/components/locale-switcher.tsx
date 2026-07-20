'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Globe } from 'lucide-react';

const LOCALES = [
  { code: 'es', label: 'Español', short: 'ES', flag: '🇨🇴' },
  { code: 'en', label: 'English', short: 'EN', flag: '🇺🇸' },
] as const;

interface LocaleSwitcherProps {
  currentLocale: string;
}

export function LocaleSwitcher({ currentLocale }: LocaleSwitcherProps) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  const switchLocale = async (locale: string) => {
    if (locale === currentLocale || switching) return;
    setSwitching(true);

    try {
      await fetch('/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
    } catch {
      // Best-effort: cookie might still work on next request
    }

    router.refresh();
    // Small delay for the cookie to be processed, then full reload
    setTimeout(() => window.location.reload(), 100);
  };

  const current = LOCALES.find((l) => l.code === currentLocale) ?? LOCALES[0];

  return (
    <div className="flex flex-col gap-1 px-3 pb-2">
      <div className="flex items-center gap-1.5 px-0.5 text-[11px] font-medium text-muted-foreground">
        <Globe className="size-3" />
        Idioma · Language
      </div>
      <div className="flex gap-1">
        {LOCALES.map((locale) => (
          <button
            key={locale.code}
            type="button"
            onClick={() => switchLocale(locale.code)}
            disabled={switching}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all',
              locale.code === currentLocale
                ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              switching && 'opacity-50 cursor-not-allowed',
            )}
            title={locale.label}
          >
            <span className="text-sm leading-none">{locale.flag}</span>
            <span>{locale.short}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
