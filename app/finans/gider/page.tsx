import { AppShell } from "@/components/app-shell";
import { GiderClient } from "@/components/finans/gider-client";
import { hasHotelPermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

type PageProps = {
  searchParams: Promise<{ otelId?: string }>;
};

export default async function GiderPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const [allHotels, permissions] = await Promise.all([
    prisma.otel.findMany({ where: { silindiMi: false, aktifMi: true }, orderBy: { ad: "asc" } }),
    prisma.kullaniciOtelYetkisi.findMany({ where: { kullaniciId: session.id } })
  ]);
  const visibleHotels = session.rol === "SUPER_ADMIN" ? allHotels : allHotels.filter((hotel) => permissions.some((permission) => permission.otelId === hotel.id));
  const selectedHotel = visibleHotels.find((hotel) => hotel.id === Number(params.otelId)) ?? visibleHotels[0] ?? null;

  if (!selectedHotel) {
    return (
      <AppShell hotelSelectorAction="/finans/gider">
        <section className="rounded-md border border-border bg-surface p-4">Yetkili otel bulunamadı.</section>
      </AppShell>
    );
  }

  const decision = hasHotelPermission(session, permissions, selectedHotel.id, "finans", "SINIRLI");
  if (!decision.allowed) {
    return (
      <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/finans/gider">
        <section className="rounded-md border border-border bg-surface p-4">Gider kaydetmek için finans yetkiniz yeterli değil.</section>
      </AppShell>
    );
  }

  const [hesaplar, cariler, giderler] = await Promise.all([
    prisma.hesap.findMany({ where: { otelId: selectedHotel.id, silindiMi: false, aktifMi: true }, orderBy: [{ tur: "asc" }, { ad: "asc" }] }),
    prisma.cari.findMany({ where: { silindiMi: false, aktifMi: true }, orderBy: { ad: "asc" } }),
    prisma.hesapHareket.findMany({
      where: { hesap: { otelId: selectedHotel.id }, tur: { in: ["GIDER", "ODEME"] }, silindiMi: false },
      include: {
        hesap: { select: { ad: true } },
        olusturan: { select: { adSoyad: true } },
        cariHareket: { include: { cari: { select: { ad: true } } } }
      },
      orderBy: { tarih: "desc" },
      take: 20
    })
  ]);

  return (
    <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/finans/gider">
      <GiderClient
        cariler={cariler.map((cari) => ({ id: cari.id, ad: cari.ad }))}
        giderler={giderler.map((item) => ({
          id: item.id,
          tarih: item.tarih.toISOString(),
          tutar: item.tutar.toString(),
          kategori: item.kategori,
          aciklama: item.aciklama,
          hesap: item.hesap,
          olusturan: item.olusturan,
          cari: item.cariHareket?.cari ?? null
        }))}
        hesaplar={hesaplar.map((hesap) => ({ id: hesap.id, ad: hesap.ad, tur: hesap.tur }))}
        hotels={visibleHotels.map((hotel) => ({ id: hotel.id, ad: hotel.ad }))}
        selectedHotelId={selectedHotel.id}
      />
    </AppShell>
  );
}
