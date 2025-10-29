'use client';

import * as React from 'react';
import { ToastProvider as PrimitiveProvider } from '@radix-ui/react-toast';
import { Toast, ToastDescription, ToastTitle, ToastViewport } from './toast';

export type AppToast = {
  id?: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'success' | 'warn' | 'danger';
  duration?: number;
};

type ToastContextValue = {
  push: (toast: AppToast) => void;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<AppToast[]>([]);

  const push = React.useCallback((toast: AppToast) => {
    setToasts((current) => {
      const id = toast.id ?? crypto.randomUUID();
      return [...current, { ...toast, id }];
    });
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      <PrimitiveProvider swipeDirection="right">
        {children}
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            variant={toast.variant}
            open
            duration={toast.duration ?? 4000}
            onOpenChange={(open) => {
              if (!open && toast.id) dismiss(toast.id);
            }}
          >
            {toast.title ? <ToastTitle>{toast.title}</ToastTitle> : null}
            {toast.description ? <ToastDescription>{toast.description}</ToastDescription> : null}
          </Toast>
        ))}
        <ToastViewport />
      </PrimitiveProvider>
    </ToastContext.Provider>
  );
}
