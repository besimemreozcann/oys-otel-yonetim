import { AppShell } from "@/components/app-shell";
import { RezervasyonForm } from "@/components/rezervasyonlar/rezervasyon-form";
import { calculateBalanceCents, centsToDecimalString, dateOnly, todayIstanbulDateString } from "@/lib/faz3";
import { hasHotelPermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

type PageProps = {
  searchParams: Promise<{ otelId?: string; odaId?: string; tarih?: string }>;
};

export default async function YeniRezervasyonPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const [allHotels, permissions] = await Promise.all([
    prisma.otel.findMany({ where: { silindiMi: false, aktifMi: true }, orderBy: { ad: "asc" } }),
    prisma.kullaniciOtelYetkisi.findMany({ where: { kullaniciId: session.id } })
  ]);
  const visibleHotels =
    session.rol === "SUPER_ADMIN"
      ? allHotels
      : allHotels.filter((hotel) => permissions.some((permission) => permission.otelId === hotel.id));
  const selectedHotel = visibleHotels.find((hotel) => hotel.id === Number(params.otelId)) ?? visibleHotels[0] ?? null;

  if (!selectedHotel) {
    return (
      <AppShell hotelSelectorAction="/rezervasyonlar/yeni">
        <section className="rounded-md border border-border bg-surface p-4">Yetkili otel bulunamadı.</section>
      </AppShell>
    );
  }

  const addDecision = hasHotelPermission(session, permissions, selectedHotel.id, "rezervasyon", "EKLE");
  if (!addDecision.allowed) {
    return (
      <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/rezervasyonlar/yeni">
        <section className="rounded-md border border-border bg-surface p-4">Bu otel için rezervasyon ekleme yetkiniz yok.</section>
      </AppShell>
    );
  }

  const giris = params.tarih ?? todayIstanbulDateString();
  const cikisDate = dateOnly(giris);
  cikisDate.setUTCDate(cikisDate.getUTCDate() + 1);

  const [rooms, cariler, hesaplar] = await Promise.all([
    prisma.oda.findMany({
      where: { otelId: selectedHotel.id, silindiMi: false, aktifMi: true },
      include: {
        kat: { select: { ad: true, sira: true } },
        rezervasyonlar: {
          where: {
            silindiMi: false,
            durum: { not: "IPTAL" },
            girisTarihi: { lt: cikisDate },
            cikisTarihi: { gt: dateOnly(giris) }
          },
          select: { id: true }
        }
      },
      orderBy: [{ kat: { sira: "asc" } }, { odaNo: "asc" }]
    }),
    prisma.cari.findMany({
      where: { silindiMi: false, aktifMi: true },
      include: { hareketler: { where: { silindiMi: false }, select: { borc: true, alacak: true } } },
      orderBy: { ad: "asc" }
    }),
    prisma.hesap.findMany({
      where: { otelId: selectedHotel.id, silindiMi: false, aktifMi: true },
      orderBy: [{ tur: "asc" }, { ad: "asc" }]
    })
  ]);

  return (
    <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/rezervasyonlar/yeni">
      <RezervasyonForm
        cariler={cariler.map((cari) => ({
          id: cari.id,
          ad: cari.ad,
          tur: cari.tur,
          telefon: cari.telefon,
          whatsapp: cari.whatsapp,
          eposta: cari.eposta,
          bakiye: centsToDecimalString(calculateBalanceCents(cari.hareketler))
        }))}
        hesaplar={hesaplar.map((hesap) => ({
          id: hesap.id,
          ad: hesap.ad,
          tur: hesap.tur
        }))}
        hotels={visibleHotels.map((hotel) => ({ id: hotel.id, ad: hotel.ad }))}
        initialDate={giris}
        initialRoomId={params.odaId ? Number(params.odaId) : undefined}
        initialRooms={rooms.map((room) => ({
          id: room.id,
          odaNo: room.odaNo,
          odaTipi: room.odaTipi,
          kapasite: room.kapasite,
          operasyonDurumu: room.operasyonDurumu,
          kat: room.kat,
          musaitMi: room.rezervasyonlar.length === 0
        }))}
        selectedHotelId={selectedHotel.id}
      />
    </AppShell>
  );
}
