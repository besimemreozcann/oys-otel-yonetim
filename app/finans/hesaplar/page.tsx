import { AppShell } from "@/components/app-shell";
import { HesapListClient } from "@/components/finans/hesap-list-client";
import { hasHotelPermission } from "@/lib/authz";
import { centsToDecimalString } from "@/lib/faz3";
import { calculateAccountBalanceCents } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

type PageProps = {
  searchParams: Promise<{ otelId?: string }>;
};

export default async function FinansHesaplarPage({ searchParams }: PageProps) {
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
      <AppShell hotelSelectorAction="/finans/hesaplar">
        <section className="rounded-md border border-border bg-surface p-4">Yetkili otel bulunamadı.</section>
      </AppShell>
    );
  }

  const viewDecision = hasHotelPermission(session, permissions, selectedHotel.id, "finans", "GORUNTULE");
  if (!viewDecision.allowed) {
    return (
      <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/finans/hesaplar">
        <section className="rounded-md border border-border bg-surface p-4">Finans hesaplarını görüntüleme yetkiniz yok.</section>
      </AppShell>
    );
  }

  const hesaplar = await prisma.hesap.findMany({
    where: { otelId: selectedHotel.id, silindiMi: false },
    include: { hareketler: { where: { silindiMi: false }, select: { tur: true, tutar: true } } },
    orderBy: [{ aktifMi: "desc" }, { tur: "asc" }, { ad: "asc" }]
  });
  const canEdit = hasHotelPermission(session, permissions, selectedHotel.id, "finans", "TAM").allowed;

  return (
    <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/finans/hesaplar">
      <HesapListClient
        canEdit={canEdit}
        hesaplar={hesaplar.map((hesap) => ({
          id: hesap.id,
          tur: hesap.tur,
          ad: hesap.ad,
          bankaAdi: hesap.bankaAdi,
          iban: hesap.iban,
          aktifMi: hesap.aktifMi,
          bakiye: centsToDecimalString(calculateAccountBalanceCents(hesap.hareketler))
        }))}
        hotels={visibleHotels.map((hotel) => ({ id: hotel.id, ad: hotel.ad }))}
        selectedHotelId={selectedHotel.id}
      />
    </AppShell>
  );
}
