'use client';

import { ReactNode } from 'react';

interface SettingsCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}

export function SettingsCard({ title, description, children, action }: SettingsCardProps) {
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
          {description && (
            <p className="text-sm text-[var(--text-secondary)] mt-1">{description}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

interface SettingsFieldProps {
  label: string;
  description?: string;
  children: ReactNode;
  horizontal?: boolean;
}

export function SettingsField({ label, description, children, horizontal = false }: SettingsFieldProps) {
  if (horizontal) {
    return (
      <div className="flex items-center justify-between py-2">
        <div>
          <label className="text-sm font-medium text-[var(--text-primary)]">{label}</label>
          {description && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>
          )}
        </div>
        <div>{children}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[var(--text-primary)]">{label}</label>
      {description && (
        <p className="text-xs text-[var(--text-muted)]">{description}</p>
      )}
      <div>{children}</div>
    </div>
  );
}
