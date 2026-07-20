import { AppShell } from "@/components/app-shell";
import { HesapDetailClient } from "@/components/finans/hesap-detail-client";
import { hasHotelPermission } from "@/lib/authz";
import { centsToDecimalString, decimalToCents } from "@/lib/faz3";
import { calculateAccountBalanceCents, hesapHareketYon } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ otelId?: string }>;
};

export default async function HesapDetayPage({ params, searchParams }: PageProps) {
  const session = await requireSession();
  const [{ id: rawId }, query] = await Promise.all([params, searchParams]);
  const hesapId = Number(rawId);
  const [allHotels, permissions] = await Promise.all([
    prisma.otel.findMany({ where: { silindiMi: false, aktifMi: true }, orderBy: { ad: "asc" } }),
    prisma.kullaniciOtelYetkisi.findMany({ where: { kullaniciId: session.id } })
  ]);
  const visibleHotels = session.rol === "SUPER_ADMIN" ? allHotels : allHotels.filter((hotel) => permissions.some((permission) => permission.otelId === hotel.id));
  const selectedHotel = visibleHotels.find((hotel) => hotel.id === Number(query.otelId)) ?? visibleHotels[0] ?? null;

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
        <section className="rounded-md border border-border bg-surface p-4">Hesap ekstresi görüntüleme yetkiniz yok.</section>
      </AppShell>
    );
  }

  const hesap = await prisma.hesap.findFirst({
    where: { id: hesapId, otelId: selectedHotel.id, silindiMi: false },
    include: {
      hareketler: {
        where: { silindiMi: false },
        include: { olusturan: { select: { adSoyad: true, kullaniciAdi: true } } },
        orderBy: { tarih: "asc" }
      }
    }
  });
  if (!hesap) {
    return (
      <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/finans/hesaplar">
        <section className="rounded-md border border-border bg-surface p-4">Hesap bulunamadı.</section>
      </AppShell>
    );
  }

  let runningBalanceCents = 0;

  return (
    <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/finans/hesaplar">
      <HesapDetailClient
        hesap={{
          id: hesap.id,
          ad: hesap.ad,
          tur: hesap.tur,
          bankaAdi: hesap.bankaAdi,
          iban: hesap.iban,
          bakiye: centsToDecimalString(calculateAccountBalanceCents(hesap.hareketler))
        }}
        hareketler={hesap.hareketler.map((hareket) => {
          const tutarCents = decimalToCents(hareket.tutar);
          const yon = hesapHareketYon(hareket.tur);
          runningBalanceCents += yon * tutarCents;
          return {
            id: hareket.id,
            tarih: hareket.tarih.toISOString(),
            tur: hareket.tur,
            giris: yon > 0 ? centsToDecimalString(tutarCents) : "0.00",
            cikis: yon < 0 ? centsToDecimalString(tutarCents) : "0.00",
            bakiye: centsToDecimalString(runningBalanceCents),
            aciklama: hareket.aciklama,
            kategori: hareket.kategori,
            olusturan: hareket.olusturan
          };
        })}
      />
    </AppShell>
  );
}
