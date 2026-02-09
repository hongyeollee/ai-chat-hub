'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const hasVisited = localStorage.getItem('hasVisitedLanding');
    if (hasVisited) {
      // Returning user - redirect to chat (middleware will handle auth check)
      router.replace('/ko/chat');
    } else {
      // First-time visitor - show landing page
      router.replace('/ko');
    }
  }, [router]);

  // Show loading state while checking
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="flex gap-1">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}
