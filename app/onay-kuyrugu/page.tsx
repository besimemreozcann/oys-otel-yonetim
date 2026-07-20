import { AppShell } from "@/components/app-shell";
import { OnayKuyruguClient } from "@/components/onay/onay-kuyrugu-client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ otelId?: string; durum?: string }>;
};

export default async function OnayKuyruguPage({ searchParams }: PageProps) {
  const session = await requireSession();
  if (session.rol === "PERSONEL") redirect("/dashboard");

  const params = await searchParams;
  const [allHotels, permissions] = await Promise.all([
    prisma.otel.findMany({ where: { silindiMi: false, aktifMi: true }, orderBy: { ad: "asc" } }),
    prisma.kullaniciOtelYetkisi.findMany({ where: { kullaniciId: session.id } })
  ]);
  const visibleHotels = session.rol === "SUPER_ADMIN" ? allHotels : allHotels.filter((hotel) => permissions.some((permission) => permission.otelId === hotel.id));
  const selectedHotel = visibleHotels.find((hotel) => hotel.id === Number(params.otelId)) ?? visibleHotels[0] ?? null;
  const durum = params.durum ?? "BEKLIYOR";
  const rows = selectedHotel
    ? await prisma.onayTalebi.findMany({
        where: {
          otelId: selectedHotel.id,
          ...(durum ? { durum: durum as any } : {}),
          tur: "REZERVASYON_SILME"
        },
        include: {
          talepEden: { select: { adSoyad: true, kullaniciAdi: true } },
          kararVeren: { select: { adSoyad: true, kullaniciAdi: true } },
          otel: { select: { ad: true } }
        },
        orderBy: [{ durum: "asc" }, { createdAt: "desc" }]
      })
    : [];

  return (
    <AppShell selectedHotelId={selectedHotel?.id} hotelSelectorAction="/onay-kuyrugu">
      <div className="grid gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Onay Kuyrugu</h1>
          <p className="mt-1 text-sm text-muted">Bu fazda rezervasyon iptal talepleri yonetici onayina baglanir.</p>
        </div>
        <form action="/onay-kuyrugu" className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface p-4">
          <label className="grid gap-1 text-sm">
            Otel
            <Select name="otelId" defaultValue={selectedHotel?.id ?? ""}>
              {visibleHotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>{hotel.ad}</option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm">
            Durum
            <Select name="durum" defaultValue={durum}>
              <option value="">Tum Talepler</option>
              <option value="BEKLIYOR">Bekliyor</option>
              <option value="ONAYLANDI">Onaylandi</option>
              <option value="REDDEDILDI">Reddedildi</option>
            </Select>
          </label>
          <Button type="submit">Filtrele</Button>
        </form>
        <section className="rounded-md border border-border bg-surface p-4">
          <OnayKuyruguClient rows={rows} />
        </section>
      </div>
    </AppShell>
  );
}
