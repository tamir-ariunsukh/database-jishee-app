'use client';

import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-center"
      richColors
      closeButton
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: 'group toast rounded-xl border shadow-lg',
          description: 'text-muted-foreground',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
