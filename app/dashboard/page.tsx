import { AppShell } from "@/components/app-shell";
import { dateOnly, formatDateTR } from "@/lib/faz3";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

type PageProps = {
  searchParams: Promise<{ otelId?: string }>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const selectedHotelId = params.otelId ? Number(params.otelId) : undefined;
  const permissions = await prisma.kullaniciOtelYetkisi.findMany({
    where: { kullaniciId: session.id },
    include: { otel: true }
  });
  const visibleHotelIds = permissions.map((permission) => permission.otelId);
  const hotelWhere =
    session.rol === "SUPER_ADMIN"
      ? { silindiMi: false }
      : { silindiMi: false, id: { in: visibleHotelIds } };
  const selectedReservationHotelWhere =
    selectedHotelId && (session.rol === "SUPER_ADMIN" || visibleHotelIds.includes(selectedHotelId))
      ? { otelId: selectedHotelId }
      : session.rol === "SUPER_ADMIN"
        ? {}
        : { otelId: { in: visibleHotelIds } };

  const today = dateOnly(new Date());
  const [hotelCount, roomCount, userCount, occupiedOrReservedRooms, checkIns, checkOuts] = await Promise.all([
    prisma.otel.count({ where: hotelWhere }),
    prisma.oda.count({ where: { silindiMi: false, otel: hotelWhere } }),
    prisma.kullanici.count({ where: { aktifMi: true } }),
    prisma.oda.count({
      where: {
        silindiMi: false,
        operasyonDurumu: { in: ["DOLU", "REZERVE"] },
        otel: hotelWhere
      }
    }),
    prisma.rezervasyon.findMany({
      where: { ...selectedReservationHotelWhere, silindiMi: false, girisTarihi: today, durum: "ONAYLANDI" },
      include: { cari: { select: { ad: true } }, oda: { select: { odaNo: true } }, otel: { select: { ad: true } } },
      orderBy: { girisSaati: "asc" }
    }),
    prisma.rezervasyon.findMany({
      where: { ...selectedReservationHotelWhere, silindiMi: false, cikisTarihi: today, durum: "GIRIS_YAPILDI" },
      include: { cari: { select: { ad: true } }, oda: { select: { odaNo: true } }, otel: { select: { ad: true } } },
      orderBy: { cikisSaati: "asc" }
    })
  ]);
  const occupancy = roomCount > 0 ? Math.round((occupiedOrReservedRooms / roomCount) * 100) : 0;

  return (
    <AppShell selectedHotelId={selectedHotelId}>
      <div className="grid gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Ana panel</h1>
          <p className="mt-1 text-sm text-muted">Otel, oda, rezervasyon ve yetki özeti.</p>
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
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-md border border-border bg-surface p-4">
            <div className="text-sm text-muted">Genel doluluk</div>
            <div className="mt-2 text-3xl font-semibold">{occupancy}%</div>
          </div>
          <div className="rounded-md border border-border bg-surface p-4">
            <div className="text-sm text-muted">Bugünkü giriş</div>
            <div className="mt-2 text-3xl font-semibold">{checkIns.length}</div>
          </div>
          <div className="rounded-md border border-border bg-surface p-4">
            <div className="text-sm text-muted">Bugünkü çıkış</div>
            <div className="mt-2 text-3xl font-semibold">{checkOuts.length}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <section className="rounded-md border border-border bg-surface p-4">
            <h2 className="text-base font-semibold">Bugünkü giriş yapacaklar</h2>
            <div className="mt-3 grid gap-2 text-sm">
              {checkIns.length ? (
                checkIns.map((item) => (
                  <div key={item.id} className="rounded-md border border-border px-3 py-2">
                    <div className="font-medium">
                      {item.oda.odaNo} · {item.cari.ad} · {item.kisiSayisi} kişi
                    </div>
                    <div className="text-muted">
                      {item.otel.ad} · {formatDateTR(item.girisTarihi)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-muted">Bugün giriş yapacak onaylı rezervasyon yok.</div>
              )}
            </div>
          </section>
          <section className="rounded-md border border-border bg-surface p-4">
            <h2 className="text-base font-semibold">Bugünkü çıkış yapacaklar</h2>
            <div className="mt-3 grid gap-2 text-sm">
              {checkOuts.length ? (
                checkOuts.map((item) => (
                  <div key={item.id} className="rounded-md border border-border px-3 py-2">
                    <div className="font-medium">
                      {item.oda.odaNo} · {item.cari.ad} · {item.kisiSayisi} kişi
                    </div>
                    <div className="text-muted">
                      {item.otel.ad} · {formatDateTR(item.cikisTarihi)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-muted">Bugün çıkış yapacak rezervasyon yok.</div>
              )}
            </div>
          </section>
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
