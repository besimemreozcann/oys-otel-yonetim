import { AppShell } from "@/components/app-shell";
import { KrokiEditor, type KrokiRoom } from "@/components/kroki/kroki-editor";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

type PageProps = {
  searchParams: Promise<{ otelId?: string; katId?: string }>;
};

function dateOnlyToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export default async function KrokiPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;

  const [hotels, permissions] = await Promise.all([
    prisma.otel.findMany({
      where: { silindiMi: false, aktifMi: true },
      orderBy: { ad: "asc" }
    }),
    prisma.kullaniciOtelYetkisi.findMany({ where: { kullaniciId: session.id } })
  ]);

  const visibleHotels =
    session.rol === "SUPER_ADMIN"
      ? hotels
      : hotels.filter((hotel) => permissions.some((permission) => permission.otelId === hotel.id));

  const requestedHotelId = params.otelId ? Number(params.otelId) : undefined;
  const selectedHotel =
    visibleHotels.find((hotel) => hotel.id === requestedHotelId) ?? visibleHotels[0] ?? null;

  if (!selectedHotel) {
    return (
      <AppShell hotelSelectorAction="/kroki">
        <section className="rounded-md border border-border bg-surface p-4">
          <h1 className="text-xl font-semibold">Yetkili otel bulunamadı</h1>
          <p className="mt-2 text-sm text-muted">Kroki görüntülemek için en az bir aktif otel yetkisi gerekir.</p>
        </section>
      </AppShell>
    );
  }

  const floors = await prisma.kat.findMany({
    where: { otelId: selectedHotel.id },
    orderBy: [{ sira: "asc" }, { ad: "asc" }]
  });
  const requestedFloorId = params.katId ? Number(params.katId) : undefined;
  const selectedFloor = floors.find((floor) => floor.id === requestedFloorId) ?? floors[0] ?? null;

  const today = dateOnlyToday();
  const rooms: KrokiRoom[] = selectedFloor
    ? (
        await prisma.oda.findMany({
          where: { otelId: selectedHotel.id, katId: selectedFloor.id, silindiMi: false },
          orderBy: { odaNo: "asc" },
          include: {
            rezervasyonlar: {
              where: {
                silindiMi: false,
                durum: { not: "IPTAL" },
                girisTarihi: { lte: today },
                cikisTarihi: { gt: today }
              },
              take: 1,
              include: { cari: { select: { ad: true } } }
            }
          }
        })
      ).map((room) => {
        const activeReservation = room.rezervasyonlar[0];
        return {
          id: room.id,
          odaNo: room.odaNo,
          odaTipi: room.odaTipi,
          kapasite: room.kapasite,
          aciklama: room.aciklama,
          operasyonDurumu: room.operasyonDurumu,
          krokiX: room.krokiX,
          krokiY: room.krokiY,
          krokiGenislik: room.krokiGenislik,
          krokiYukseklik: room.krokiYukseklik,
          aktifRezervasyon: activeReservation
            ? {
                cariAd: activeReservation.cari.ad,
                giris: activeReservation.girisTarihi.toISOString(),
                cikis: activeReservation.cikisTarihi.toISOString(),
                kisiSayisi: activeReservation.kisiSayisi
              }
            : null
        };
      })
    : [];

  const sketchExists = selectedFloor
    ? Boolean(
        await prisma.kroki.findFirst({
          where: { otelId: selectedHotel.id, katId: selectedFloor.id },
          select: { id: true }
        })
      )
    : false;

  return (
    <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/kroki">
      <KrokiEditor
        floors={floors}
        hotels={visibleHotels.map((hotel) => ({ id: hotel.id, ad: hotel.ad }))}
        initialRooms={rooms}
        selectedFloorId={selectedFloor?.id ?? null}
        selectedHotelId={selectedHotel.id}
        sketchExists={sketchExists}
      />
    </AppShell>
  );
}
