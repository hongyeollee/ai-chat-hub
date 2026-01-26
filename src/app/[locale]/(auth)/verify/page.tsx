import { Suspense } from 'react';
import { VerifyCodeForm } from '@/components/auth/VerifyCodeForm';

export default function VerifyPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyCodeForm />
    </Suspense>
  );
}
