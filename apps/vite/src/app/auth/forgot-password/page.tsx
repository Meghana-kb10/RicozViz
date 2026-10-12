import * as React from 'react';
import { ForgotPasswordHeader } from './components/header/header';
import { ForgotPasswordForm } from './components/forgot-password-form/forgot-password-form';
import { ForgotPasswordProvider } from './context/forgot-password.context';

export default function ForgotPasswordPage() {
  return (
    <ForgotPasswordProvider>
      <div className="w-full flex flex-col">
        <ForgotPasswordHeader />
        <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 flex items-center justify-center">
          <ForgotPasswordForm />
        </div>
      </div>
    </ForgotPasswordProvider>
  );
}
