import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export default async function DashboardPage({
  searchParams
}: {
  searchParams: { otelId?: string };
}) {
  const session = await requireSession();
  const selectedHotelId = searchParams.otelId ? Number(searchParams.otelId) : undefined;
  const permissions = await prisma.kullaniciOtelYetkisi.findMany({
    where: { kullaniciId: session.id },
    include: { otel: true }
  });
  const hotelWhere =
    session.rol === "SUPER_ADMIN"
      ? { silindiMi: false }
      : { silindiMi: false, id: { in: permissions.map((permission) => permission.otelId) } };

  const [hotelCount, roomCount, userCount] = await Promise.all([
    prisma.otel.count({ where: hotelWhere }),
    prisma.oda.count({ where: { silindiMi: false, otel: hotelWhere } }),
    prisma.kullanici.count({ where: { aktifMi: true } })
  ]);

  return (
    <AppShell selectedHotelId={selectedHotelId}>
      <div className="grid gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Ana panel</h1>
          <p className="mt-1 text-sm text-muted">Faz 1 temel kurulum ve yetki doğrulama görünümü.</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-md border border-border bg-surface p-4">
            <div className="text-sm text-muted">Görülebilen otel</div>
            <div className="mt-2 text-3xl font-semibold">{hotelCount}</div>
          </div>
          <div className="rounded-md border border-border bg-surface p-4">
            <div className="text-sm text-muted">Aktif oda</div>
            <div className="mt-2 text-3xl font-semibold">{roomCount}</div>
          </div>
          <div className="rounded-md border border-border bg-surface p-4">
            <div className="text-sm text-muted">Aktif kullanıcı</div>
            <div className="mt-2 text-3xl font-semibold">{userCount}</div>
          </div>
        </div>
        <section className="rounded-md border border-border bg-surface p-4">
          <h2 className="text-base font-semibold">Yetkili oteller</h2>
          <div className="mt-3 overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-[#eef3f6] text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Otel</th>
                  <th className="px-3 py-2">Rezervasyon</th>
                  <th className="px-3 py-2">Cari</th>
                  <th className="px-3 py-2">Finans</th>
                  <th className="px-3 py-2">Rapor</th>
                </tr>
              </thead>
              <tbody>
                {session.rol === "SUPER_ADMIN" ? (
                  <tr>
                    <td className="px-3 py-2" colSpan={5}>
                      SUPER_ADMIN tüm otellere ve işlemlere erişir.
                    </td>
                  </tr>
                ) : (
                  permissions.map((permission) => (
                    <tr key={permission.id} className="border-t border-border">
                      <td className="px-3 py-2">{permission.otel.ad}</td>
                      <td className="px-3 py-2">{permission.rezervasyonYetkisi}</td>
                      <td className="px-3 py-2">{permission.cariYetkisi}</td>
                      <td className="px-3 py-2">{permission.finansYetkisi}</td>
                      <td className="px-3 py-2">{permission.raporYetkisi}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
