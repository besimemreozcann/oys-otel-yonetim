import { AppShell } from "@/components/app-shell";
import { CariDetailClient } from "@/components/cariler/cari-detail-client";
import { calculateBalanceCents, centsToDecimalString } from "@/lib/faz3";
import { hasHotelPermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ otelId?: string }>;
};

function decimalString(value: { toString(): string }) {
  return value.toString();
}

export default async function CariDetailPage({ params, searchParams }: PageProps) {
  const session = await requireSession();
  const [{ id: rawId }, query] = await Promise.all([params, searchParams]);
  const cariId = Number(rawId);
  const [allHotels, permissions] = await Promise.all([
    prisma.otel.findMany({ where: { silindiMi: false, aktifMi: true }, orderBy: { ad: "asc" } }),
    prisma.kullaniciOtelYetkisi.findMany({ where: { kullaniciId: session.id } })
  ]);
  const visibleHotels =
    session.rol === "SUPER_ADMIN"
      ? allHotels
      : allHotels.filter((hotel) => permissions.some((permission) => permission.otelId === hotel.id));
  const selectedHotel =
    visibleHotels.find((hotel) => hotel.id === Number(query.otelId)) ?? visibleHotels[0] ?? null;

  if (!selectedHotel) {
    return (
      <AppShell hotelSelectorAction="/cariler">
        <section className="rounded-md border border-border bg-surface p-4">Yetkili otel bulunamadı.</section>
      </AppShell>
    );
  }

  const viewDecision = hasHotelPermission(session, permissions, selectedHotel.id, "cari", "GORUNTULE");
  if (!viewDecision.allowed) {
    return (
      <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/cariler">
        <section className="rounded-md border border-border bg-surface p-4">Bu cari kartı görüntüleme yetkiniz yok.</section>
      </AppShell>
    );
  }

  const cari = await prisma.cari.findFirst({
    where: { id: cariId, silindiMi: false },
    include: {
      yetkililer: { orderBy: { adSoyad: "asc" } },
      iletisimKayitlari: {
        orderBy: { tarihSaat: "desc" },
        include: { kullanici: { select: { adSoyad: true } } }
      },
      hareketler: {
        where: { silindiMi: false },
        orderBy: { tarih: "asc" },
        include: { otel: { select: { ad: true } }, rezervasyon: { include: { oda: { select: { odaNo: true } } } } }
      },
      rezervasyonlar: {
        where: { silindiMi: false },
        orderBy: { girisTarihi: "desc" },
        include: { otel: { select: { ad: true } }, oda: { select: { odaNo: true } } }
      }
    }
  });

  if (!cari) {
    return (
      <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/cariler">
        <section className="rounded-md border border-border bg-surface p-4">Cari bulunamadı.</section>
      </AppShell>
    );
  }

  const canEdit = hasHotelPermission(session, permissions, selectedHotel.id, "cari", "TAM").allowed;

  return (
    <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/cariler">
      <CariDetailClient
        canEdit={canEdit}
        selectedHotelId={selectedHotel.id}
        cari={{
          id: cari.id,
          ad: cari.ad,
          tur: cari.tur,
          vergiNo: cari.vergiNo,
          vergiDairesi: cari.vergiDairesi,
          adres: cari.adres,
          telefon: cari.telefon,
          whatsapp: cari.whatsapp,
          eposta: cari.eposta,
          aktifMi: cari.aktifMi,
          bakiye: centsToDecimalString(calculateBalanceCents(cari.hareketler)),
          yetkililer: cari.yetkililer,
          iletisimKayitlari: cari.iletisimKayitlari.map((item) => ({
            id: item.id,
            tarihSaat: item.tarihSaat.toISOString(),
            tur: item.tur,
            aciklama: item.aciklama,
            kullanici: item.kullanici
          })),
          hareketler: cari.hareketler.map((item) => ({
            id: item.id,
            tarih: item.tarih.toISOString(),
            tur: item.tur,
            borc: decimalString(item.borc),
            alacak: decimalString(item.alacak),
            odemeYontemi: item.odemeYontemi,
            aciklama: item.aciklama,
            otel: item.otel,
            rezervasyon: item.rezervasyon
              ? {
                  kisiSayisi: item.rezervasyon.kisiSayisi,
                  oda: item.rezervasyon.oda
                }
              : null
          })),
          rezervasyonlar: cari.rezervasyonlar.map((item) => ({
            id: item.id,
            otel: item.otel,
            oda: item.oda,
            girisTarihi: item.girisTarihi.toISOString(),
            cikisTarihi: item.cikisTarihi.toISOString(),
            kisiSayisi: item.kisiSayisi,
            toplamTutar: decimalString(item.toplamTutar),
            durum: item.durum
          }))
        }}
      />
    </AppShell>
  );
}
