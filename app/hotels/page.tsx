import { AppShell } from "@/components/app-shell";
import { HotelAdmin } from "@/components/hotel-admin";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export default async function HotelsPage() {
  const session = await requireSession();
  const permissions = await prisma.kullaniciOtelYetkisi.findMany({ where: { kullaniciId: session.id } });
  const visibleIds = permissions.map((permission) => permission.otelId);
  const hotels = await prisma.otel.findMany({
    where: {
      silindiMi: false,
      ...(session.rol === "SUPER_ADMIN" ? {} : { id: { in: visibleIds } })
    },
    include: {
      katlar: { orderBy: [{ sira: "asc" }, { ad: "asc" }] },
      odalar: { where: { silindiMi: false }, include: { kat: true }, orderBy: { odaNo: "asc" } }
    },
    orderBy: { ad: "asc" }
  });

  return (
    <AppShell>
      <HotelAdmin hotels={hotels} />
    </AppShell>
  );
}
