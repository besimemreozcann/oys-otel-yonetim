import { AppShell } from "@/components/app-shell";
import { RezervasyonListClient } from "@/components/rezervasyonlar/rezervasyon-list-client";
import { hasHotelPermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

type PageProps = {
  searchParams: Promise<{ otelId?: string }>;
};

function decimalString(value: { toString(): string }) {
  return value.toString();
}

export default async function RezervasyonlarPage({ searchParams }: PageProps) {
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
      <AppShell hotelSelectorAction="/rezervasyonlar">
        <section className="rounded-md border border-border bg-surface p-4">Yetkili otel bulunamadı.</section>
      </AppShell>
    );
  }

  const viewDecision = hasHotelPermission(session, permissions, selectedHotel.id, "rezervasyon", "GORUNTULE");
  if (!viewDecision.allowed) {
    return (
      <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/rezervasyonlar">
        <section className="rounded-md border border-border bg-surface p-4">Bu otel için rezervasyon görüntüleme yetkiniz yok.</section>
      </AppShell>
    );
  }

  const rezervasyonlar = await prisma.rezervasyon.findMany({
    where: { otelId: selectedHotel.id, silindiMi: false },
    include: {
      otel: { select: { ad: true } },
      oda: { select: { odaNo: true } },
      cari: { select: { ad: true } }
    },
    orderBy: { girisTarihi: "desc" }
  });

  return (
    <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/rezervasyonlar">
      <RezervasyonListClient
        hotels={visibleHotels.map((hotel) => ({ id: hotel.id, ad: hotel.ad }))}
        rezervasyonlar={rezervasyonlar.map((item) => ({
          id: item.id,
          otel: item.otel,
          oda: item.oda,
          cari: item.cari,
          girisTarihi: item.girisTarihi.toISOString(),
          cikisTarihi: item.cikisTarihi.toISOString(),
          kisiSayisi: item.kisiSayisi,
          toplamTutar: decimalString(item.toplamTutar),
          durum: item.durum
        }))}
        selectedHotelId={selectedHotel.id}
      />
    </AppShell>
  );
}
