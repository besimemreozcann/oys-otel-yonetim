import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { formatDateTR, dateOnly, todayIstanbulDateString } from "@/lib/faz3";
import { hasHotelPermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

type PageProps = {
  searchParams: Promise<{ otelId?: string; katId?: string; baslangic?: string }>;
};

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function overlaps(day: Date, reservation: { girisTarihi: Date; cikisTarihi: Date }) {
  const next = addDays(day, 1);
  return reservation.girisTarihi < next && reservation.cikisTarihi > day;
}

export default async function DolulukPage({ searchParams }: PageProps) {
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
      <AppShell hotelSelectorAction="/doluluk">
        <section className="rounded-md border border-border bg-surface p-4">Yetkili otel bulunamadı.</section>
      </AppShell>
    );
  }

  const viewDecision = hasHotelPermission(session, permissions, selectedHotel.id, "rezervasyon", "GORUNTULE");
  if (!viewDecision.allowed) {
    return (
      <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/doluluk">
        <section className="rounded-md border border-border bg-surface p-4">Doluluk görüntüleme yetkiniz yok.</section>
      </AppShell>
    );
  }

  const start = dateOnly(params.baslangic ?? todayIstanbulDateString());
  const days = Array.from({ length: 30 }, (_, index) => addDays(start, index));
  const end = addDays(start, 30);
  const selectedFloorId = params.katId ? Number(params.katId) : undefined;

  const [floors, rooms, reservations] = await Promise.all([
    prisma.kat.findMany({ where: { otelId: selectedHotel.id }, orderBy: [{ sira: "asc" }, { ad: "asc" }] }),
    prisma.oda.findMany({
      where: { otelId: selectedHotel.id, silindiMi: false, aktifMi: true, ...(selectedFloorId ? { katId: selectedFloorId } : {}) },
      include: { kat: { select: { ad: true, sira: true } } },
      orderBy: [{ kat: { sira: "asc" } }, { odaNo: "asc" }]
    }),
    prisma.rezervasyon.findMany({
      where: {
        otelId: selectedHotel.id,
        silindiMi: false,
        durum: { in: ["BEKLEMEDE", "ONAYLANDI", "GIRIS_YAPILDI"] },
        girisTarihi: { lt: end },
        cikisTarihi: { gt: start },
        ...(selectedFloorId ? { oda: { katId: selectedFloorId } } : {})
      },
      include: { cari: { select: { ad: true } } }
    })
  ]);

  return (
    <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/doluluk">
      <div className="grid gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Doluluk Takvimi</h1>
            <p className="mt-1 text-sm text-muted">Oda × tarih görünümü. Hücreye tıklayınca yeni rezervasyon formu açılır.</p>
          </div>
          <form action="/doluluk" className="flex items-center gap-2">
            <select className="h-9 rounded-md border border-border bg-white px-3 text-sm" name="otelId" defaultValue={selectedHotel.id}>
              {visibleHotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.ad}
                </option>
              ))}
            </select>
            <select className="h-9 rounded-md border border-border bg-white px-3 text-sm" name="katId" defaultValue={selectedFloorId ?? ""}>
              <option value="">Tüm Katlar</option>
              {floors.map((floor) => (
                <option key={floor.id} value={floor.id}>
                  {floor.ad}
                </option>
              ))}
            </select>
            <input className="h-9 rounded-md border border-border px-3 text-sm" name="baslangic" type="date" defaultValue={isoDate(start)} />
            <button className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white" type="submit">
              Göster
            </button>
          </form>
        </div>

        <section className="overflow-hidden rounded-md border border-border bg-surface shadow-table">
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] text-sm">
              <thead className="bg-[#eef3f6] text-left text-xs uppercase text-muted">
                <tr>
                  <th className="sticky left-0 z-10 bg-[#eef3f6] px-3 py-2">Oda</th>
                  {days.map((day) => (
                    <th key={isoDate(day)} className="px-2 py-2 text-center">
                      {new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(day)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id} className="border-t border-border">
                    <td className="sticky left-0 z-10 bg-surface px-3 py-2 font-medium">
                      {room.kat.ad} / {room.odaNo}
                    </td>
                    {days.map((day) => {
                      const reservation = reservations.find((item) => item.odaId === room.id && overlaps(day, item));
                      const occupied = reservation?.durum === "GIRIS_YAPILDI";
                      const reserved = reservation && !occupied;
                      return (
                        <td key={isoDate(day)} className="p-1">
                          {reservation ? (
                            <div
                              className={`h-8 rounded-sm px-2 py-1 text-xs ${occupied ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}
                              title={`${reservation.cari.ad} · ${formatDateTR(reservation.girisTarihi)} - ${formatDateTR(reservation.cikisTarihi)}`}
                            >
                              {reservation.cari.ad}
                            </div>
                          ) : (
                            <Link
                              className="block h-8 rounded-sm border border-emerald-100 bg-white px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
                              href={`/rezervasyonlar/yeni?otelId=${selectedHotel.id}&odaId=${room.id}&tarih=${isoDate(day)}`}
                            >
                              Boş
                            </Link>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
