import * as React from 'react';
import { LoginHeader } from './components/header/header';
import { LoginForm } from './components/login-form/login-form';
import { LoginProvider } from './context/login.context';

export default function LoginPage() {
  return (
    <LoginProvider>
      <div className="w-full flex flex-col">
        <LoginHeader />
        <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 flex items-center justify-center">
          <LoginForm />
        </div>
      </div>
    </LoginProvider>
  );
}
