"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="tr">
      <body>
        <main className="grid min-h-screen place-items-center bg-[#f6f8fb] p-6 font-sans text-[#1f2a37]">
          <section className="w-full max-w-md rounded-md border border-[#d9e1ea] bg-white p-6 text-center">
            <h1 className="text-2xl font-semibold">Sistem hatasi</h1>
            <p className="mt-2 text-sm text-[#607083]">Beklenmeyen bir hata olustu.</p>
            <button className="mt-5 rounded-md bg-[#246b9f] px-4 py-2 text-sm font-medium text-white" type="button" onClick={reset}>
              Tekrar dene
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
