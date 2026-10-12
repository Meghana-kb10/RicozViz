import * as React from 'react';
import { SignupHeader } from './components/header/header';
import { SignupForm } from './components/signup-form/signup-form';
import { SignupProvider } from './context/signup.context';

export default function SignupPage() {
  return (
    <SignupProvider>
      <div className="w-full flex flex-col">
        <SignupHeader />
        <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 flex items-center justify-center">
          <SignupForm />
        </div>
      </div>
    </SignupProvider>
  );
}
