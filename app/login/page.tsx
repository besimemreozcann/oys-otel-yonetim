import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export default async function LoginPage() {
  const session = await readSession();
  if (session) redirect("/dashboard");

  const userCount = await prisma.kullanici.count();
  const hasUsers = userCount > 0;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-md rounded-md border border-border bg-surface p-6 shadow-table">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">{hasUsers ? "Giriş yap" : "İlk kullanıcı kurulumu"}</h1>
          <p className="mt-2 text-sm text-muted">
            {hasUsers
              ? "Kullanıcı adınız ve şifrenizle panele giriş yapın."
              : "Sistemde kullanıcı yok. Oluşturulan ilk kullanıcı SUPER_ADMIN olur."}
          </p>
        </div>
        <AuthForm hasUsers={hasUsers} />
      </section>
    </main>
  );
}
