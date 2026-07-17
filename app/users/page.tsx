import { AppShell } from "@/components/app-shell";
import { UserAdmin } from "@/components/user-admin";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/session";

export default async function UsersPage() {
  await requireSuperAdmin();
  const [users, hotels] = await Promise.all([
    prisma.kullanici.findMany({
      select: {
        id: true,
        adSoyad: true,
        kullaniciAdi: true,
        rol: true,
        aktifMi: true,
        otelYetkileri: true
      },
      orderBy: { adSoyad: "asc" }
    }),
    prisma.otel.findMany({
      where: { silindiMi: false },
      orderBy: { ad: "asc" }
    })
  ]);

  return (
    <AppShell>
      <UserAdmin users={users} hotels={hotels} />
    </AppShell>
  );
}
