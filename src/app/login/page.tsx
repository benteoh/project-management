import { Suspense } from "react";

import LoginPageClient from "./LoginPageClient";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="bg-background min-h-screen" />}>
      <LoginPageClient />
    </Suspense>
  );
}
