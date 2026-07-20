"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="rounded-md border border-border bg-surface p-6">
      <h1 className="text-xl font-semibold">Bir hata olustu</h1>
      <p className="mt-2 text-sm text-muted">Islem tamamlanamadi. Tekrar deneyebilir veya ana panele donebilirsiniz.</p>
      <Button className="mt-4" type="button" onClick={reset}>Tekrar dene</Button>
    </section>
  );
}
