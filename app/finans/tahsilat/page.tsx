import { AppShell } from "@/components/app-shell";
import { TahsilatClient } from "@/components/finans/tahsilat-client";
import { hasHotelPermission } from "@/lib/authz";
import { calculateBalanceCents, centsToDecimalString } from "@/lib/faz3";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

type PageProps = {
  searchParams: Promise<{ otelId?: string }>;
};

export default async function TahsilatPage({ searchParams }: PageProps) {
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
      <AppShell hotelSelectorAction="/finans/tahsilat">
        <section className="rounded-md border border-border bg-surface p-4">Yetkili otel bulunamadı.</section>
      </AppShell>
    );
  }

  const decision = hasHotelPermission(session, permissions, selectedHotel.id, "finans", "SINIRLI");
  if (!decision.allowed) {
    return (
      <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/finans/tahsilat">
        <section className="rounded-md border border-border bg-surface p-4">Tahsilat yapmak için finans yetkiniz yeterli değil.</section>
      </AppShell>
    );
  }

  const [cariler, hesaplar, tahsilatlar] = await Promise.all([
    prisma.cari.findMany({
      where: { silindiMi: false, aktifMi: true },
      include: { hareketler: { where: { silindiMi: false }, select: { borc: true, alacak: true } } },
      orderBy: { ad: "asc" }
    }),
    prisma.hesap.findMany({ where: { otelId: selectedHotel.id, silindiMi: false, aktifMi: true }, orderBy: [{ tur: "asc" }, { ad: "asc" }] }),
    prisma.cariHareket.findMany({
      where: { otelId: selectedHotel.id, tur: "TAHSILAT", silindiMi: false },
      include: {
        cari: { select: { ad: true } },
        olusturan: { select: { adSoyad: true, kullaniciAdi: true } },
        hesapHareketler: { include: { hesap: { select: { ad: true } } } }
      },
      orderBy: { tarih: "desc" },
      take: 20
    })
  ]);

  return (
    <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/finans/tahsilat">
      <TahsilatClient
        cariler={cariler.map((cari) => ({ id: cari.id, ad: cari.ad, bakiye: centsToDecimalString(calculateBalanceCents(cari.hareketler)) }))}
        hesaplar={hesaplar.map((hesap) => ({ id: hesap.id, ad: hesap.ad, tur: hesap.tur }))}
        hotels={visibleHotels.map((hotel) => ({ id: hotel.id, ad: hotel.ad }))}
        selectedHotelId={selectedHotel.id}
        tahsilatlar={tahsilatlar.map((item) => ({
          id: item.id,
          tarih: item.tarih.toISOString(),
          alacak: item.alacak.toString(),
          odemeYontemi: item.odemeYontemi,
          aciklama: item.aciklama,
          cari: item.cari,
          olusturan: item.olusturan,
          hesapAdi: item.hesapHareketler[0]?.hesap.ad ?? "-"
        }))}
      />
    </AppShell>
  );
}
