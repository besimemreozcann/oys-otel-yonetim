import { AppShell } from "@/components/app-shell";
import { DashboardCharts } from "@/components/dashboard-charts";
import { centsToDecimalString, dateOnly, decimalToCents, formatDateTR, formatMoneyTR } from "@/lib/faz3";
import { calculateAccountBalanceCents, HESAP_TURU_LABELS } from "@/lib/finance";
import { addDays, isoDate } from "@/lib/reports";
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
  const visibleDashboardHotels =
    session.rol === "SUPER_ADMIN"
      ? await prisma.otel.findMany({ where: { silindiMi: false, aktifMi: true }, orderBy: { ad: "asc" } })
      : permissions.map((permission) => permission.otel).filter((hotel) => !hotel.silindiMi && hotel.aktifMi);
  const selectedFinanceHotel =
    visibleDashboardHotels.find((hotel) => hotel.id === selectedHotelId) ?? visibleDashboardHotels[0] ?? null;
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
  const chartStart7 = addDays(today, -6);
  const chartStart30 = addDays(today, -29);
  const [hotelCount, roomCount, userCount, occupiedOrReservedRooms, checkIns, checkOuts, hesaplar, weeklyTahsilatlar, trendReservations, topCariTahsilatlar] = await Promise.all([
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
    }),
    selectedFinanceHotel
      ? prisma.hesap.findMany({
          where: { otelId: selectedFinanceHotel.id, silindiMi: false, aktifMi: true },
          include: { hareketler: { where: { silindiMi: false }, select: { tur: true, tutar: true } } },
          orderBy: [{ tur: "asc" }, { ad: "asc" }]
        })
      : Promise.resolve([]),
    selectedFinanceHotel
      ? prisma.cariHareket.findMany({
          where: { otelId: selectedFinanceHotel.id, tur: "TAHSILAT", silindiMi: false, tarih: { gte: chartStart7, lt: addDays(today, 1) } },
          select: { tarih: true, alacak: true }
        })
      : Promise.resolve([]),
    selectedFinanceHotel
      ? prisma.rezervasyon.findMany({
          where: {
            otelId: selectedFinanceHotel.id,
            silindiMi: false,
            durum: { in: ["BEKLEMEDE", "ONAYLANDI", "GIRIS_YAPILDI"] },
            girisTarihi: { lt: addDays(today, 1) },
            cikisTarihi: { gt: chartStart30 }
          },
          select: { odaId: true, girisTarihi: true, cikisTarihi: true }
        })
      : Promise.resolve([]),
    selectedFinanceHotel
      ? prisma.cariHareket.findMany({
          where: { otelId: selectedFinanceHotel.id, tur: "TAHSILAT", silindiMi: false, tarih: { gte: chartStart30, lt: addDays(today, 1) } },
          include: { cari: { select: { ad: true } } }
        })
      : Promise.resolve([])
  ]);
  const occupancy = roomCount > 0 ? Math.round((occupiedOrReservedRooms / roomCount) * 100) : 0;
  const hesapOzetleri = hesaplar.map((hesap) => ({
    id: hesap.id,
    ad: hesap.ad,
    tur: hesap.tur,
    bakiyeCents: calculateAccountBalanceCents(hesap.hareketler)
  }));
  const toplamFinansBakiyeCents = hesapOzetleri.reduce((total, hesap) => total + hesap.bakiyeCents, 0);
  const weeklyRevenue = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(chartStart7, index);
    const key = isoDate(day);
    const total = weeklyTahsilatlar
      .filter((item) => isoDate(item.tarih) === key)
      .reduce((sum, item) => sum + decimalToCents(item.alacak), 0);
    return {
      tarih: key,
      label: new Intl.DateTimeFormat("tr-TR", { weekday: "short" }).format(day),
      tutar: total / 100
    };
  });
  const occupancyTrend = Array.from({ length: 30 }, (_, index) => {
    const day = addDays(chartStart30, index);
    const next = addDays(day, 1);
    const activeRooms = new Set(
      trendReservations
        .filter((reservation) => reservation.girisTarihi < next && reservation.cikisTarihi > day)
        .map((reservation) => reservation.odaId)
    );
    return {
      label: new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit" }).format(day),
      doluluk: roomCount ? Math.round((activeRooms.size / roomCount) * 100) : 0
    };
  });
  const topCariMap = new Map<string, number>();
  for (const item of topCariTahsilatlar) {
    topCariMap.set(item.cari.ad, (topCariMap.get(item.cari.ad) ?? 0) + decimalToCents(item.alacak));
  }
  const topCariRevenue = Array.from(topCariMap.entries())
    .map(([cari, tutar]) => ({ cari, tutar: tutar / 100 }))
    .sort((a, b) => b.tutar - a.tutar)
    .slice(0, 5);

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
        <section className="rounded-md border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Kasa/Banka Özeti</h2>
              <p className="mt-1 text-sm text-muted">{selectedFinanceHotel?.ad ?? "Otel seçilmedi"}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted">Toplam bakiye</div>
              <div className="text-2xl font-semibold">{formatMoneyTR(centsToDecimalString(toplamFinansBakiyeCents))}</div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {hesapOzetleri.length ? (
              hesapOzetleri.map((hesap) => (
                <div key={hesap.id} className="rounded-md border border-border bg-white px-3 py-2">
                  <div className="text-xs text-muted">{HESAP_TURU_LABELS[hesap.tur]}</div>
                  <div className="mt-1 font-medium">{hesap.ad}</div>
                  <div className="mt-2 text-right text-lg font-semibold">{formatMoneyTR(centsToDecimalString(hesap.bakiyeCents))}</div>
                </div>
              ))
            ) : (
              <div className="rounded-md border border-dashed border-border bg-white px-3 py-6 text-sm text-muted">Aktif hesap yok.</div>
            )}
          </div>
        </section>
        <DashboardCharts weeklyRevenue={weeklyRevenue} occupancyTrend={occupancyTrend} topCariRevenue={topCariRevenue} />
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
