'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 flex flex-col overflow-hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 m-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 self-start"
          >
            ☰
          </button>
          {children}
        </main>
      </div>
    </div>
  );
}
