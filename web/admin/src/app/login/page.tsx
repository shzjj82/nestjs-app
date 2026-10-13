import { Suspense } from 'react';
import LoginPage from './login-form';

export default function Page() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">加载中…</div>}>
      <LoginPage />
    </Suspense>
  );
}
