'use client';

import { useState, type FormHTMLAttributes, type ReactNode } from 'react';

import { AppLoadingOverlay } from './AppLoadingOverlay';

type Props = Omit<FormHTMLAttributes<HTMLFormElement>, 'action' | 'method'> & {
  children: ReactNode;
};

/** POST /auth/logout with a full-screen loading overlay while the request runs. */
export function LogoutForm({ children, onSubmit, ...rest }: Props) {
  const [loggingOut, setLoggingOut] = useState(false);

  return (
    <>
      {loggingOut ? <AppLoadingOverlay message="Signing out…" /> : null}
      <form
        {...rest}
        action="/auth/logout"
        method="post"
        onSubmit={(e) => {
          setLoggingOut(true);
          onSubmit?.(e);
        }}
      >
        {children}
      </form>
    </>
  );
}
