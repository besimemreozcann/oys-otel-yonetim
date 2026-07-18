import { AppShell } from "@/components/app-shell";
import { CariListClient } from "@/components/cariler/cari-list-client";
import { calculateBalanceCents, centsToDecimalString } from "@/lib/faz3";
import { hasHotelPermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

type PageProps = {
  searchParams: Promise<{ otelId?: string }>;
};

export default async function CarilerPage({ searchParams }: PageProps) {
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
  const requestedHotelId = params.otelId ? Number(params.otelId) : undefined;
  const selectedHotel = visibleHotels.find((hotel) => hotel.id === requestedHotelId) ?? visibleHotels[0] ?? null;

  if (!selectedHotel) {
    return (
      <AppShell hotelSelectorAction="/cariler">
        <section className="rounded-md border border-border bg-surface p-4">
          <h1 className="text-xl font-semibold">Yetkili otel bulunamadı</h1>
          <p className="mt-2 text-sm text-muted">Cari kartları görüntülemek için en az bir otel yetkisi gerekir.</p>
        </section>
      </AppShell>
    );
  }

  const viewDecision = hasHotelPermission(session, permissions, selectedHotel.id, "cari", "GORUNTULE");
  if (!viewDecision.allowed) {
    return (
      <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/cariler">
        <section className="rounded-md border border-border bg-surface p-4">
          <h1 className="text-xl font-semibold">Cari yetkisi yok</h1>
          <p className="mt-2 text-sm text-muted">Bu otel için cari kartlarını görüntüleme yetkiniz yok.</p>
        </section>
      </AppShell>
    );
  }

  const cariler = await prisma.cari.findMany({
    where: { silindiMi: false },
    include: {
      hareketler: { where: { silindiMi: false }, orderBy: { tarih: "desc" } }
    },
    orderBy: { ad: "asc" }
  });
  const canEdit = hasHotelPermission(session, permissions, selectedHotel.id, "cari", "TAM").allowed;

  return (
    <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/cariler">
      <CariListClient
        canEdit={canEdit}
        cariler={cariler.map((cari) => ({
          id: cari.id,
          ad: cari.ad,
          tur: cari.tur,
          telefon: cari.telefon,
          whatsapp: cari.whatsapp,
          eposta: cari.eposta,
          aktifMi: cari.aktifMi,
          bakiye: centsToDecimalString(calculateBalanceCents(cari.hareketler)),
          sonHareketTarihi: cari.hareketler[0]?.tarih.toISOString() ?? null
        }))}
        hotels={visibleHotels.map((hotel) => ({ id: hotel.id, ad: hotel.ad }))}
        selectedHotelId={selectedHotel.id}
      />
    </AppShell>
  );
}
