import Link from "next/link";
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <section className="w-full max-w-md rounded-md border border-border bg-surface p-6 text-center">
        <div className="text-sm font-medium text-muted">404</div>
        <h1 className="mt-2 text-2xl font-semibold">Sayfa bulunamadi</h1>
        <p className="mt-2 text-sm text-muted">Aradiginiz ekran tasinmis veya yetkiniz olmayan bir alana ait olabilir.</p>
        <Link className="mt-5 inline-flex h-9 items-center justify-center rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-[#c77e14]" href="/dashboard">
          Ana panele don
        </Link>
      </section>
    </main>
  );
}
