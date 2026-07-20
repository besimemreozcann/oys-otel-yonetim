import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { dateOnly, formatDateTR, todayIstanbulDateString } from "@/lib/faz3";
import { hasHotelPermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

type PageProps = {
  searchParams: Promise<{ otelId?: string; katId?: string; baslangic?: string; mod?: string }>;
};

type ReservationForCalendar = {
  id: number;
  odaId: number;
  girisTarihi: Date;
  cikisTarihi: Date;
  durum: "BEKLEMEDE" | "ONAYLANDI" | "GIRIS_YAPILDI" | "CIKIS_YAPILDI" | "IPTAL";
  kisiSayisi: number;
  toplamTutar: { toString(): string };
  cari: { ad: string; telefon: string | null; whatsapp: string | null };
};

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function dayKey(value: Date) {
  return new Intl.DateTimeFormat("tr-TR", { weekday: "short", day: "2-digit", month: "short" }).format(value);
}

function overlaps(day: Date, reservation: { girisTarihi: Date; cikisTarihi: Date }) {
  const next = addDays(day, 1);
  return reservation.girisTarihi < next && reservation.cikisTarihi > day;
}

function statusMeta(reservation: ReservationForCalendar | undefined) {
  if (!reservation) {
    return {
      label: "Boş",
      shortLabel: "Boş",
      cellClass: "border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
      cardClass: "border-emerald-200 bg-emerald-50 text-emerald-800"
    };
  }

  if (reservation.durum === "GIRIS_YAPILDI") {
    return {
      label: "Dolu",
      shortLabel: "Dolu",
      cellClass: "border-red-200 bg-red-100 text-red-800",
      cardClass: "border-red-200 bg-red-50 text-red-800"
    };
  }

  return {
    label: reservation.durum === "BEKLEMEDE" ? "Beklemede" : "Rezerve",
    shortLabel: reservation.durum === "BEKLEMEDE" ? "Bek." : "Rez.",
    cellClass: "border-amber-200 bg-amber-100 text-amber-900",
    cardClass: "border-amber-200 bg-amber-50 text-amber-900"
  };
}

function modeHref(mod: "genis" | "gun" | "pano", selectedHotelId: number, selectedFloorId: number | undefined, start: Date) {
  const params = new URLSearchParams({ otelId: String(selectedHotelId), baslangic: isoDate(start), mod });
  if (selectedFloorId) params.set("katId", String(selectedFloorId));
  return `/doluluk?${params.toString()}`;
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

  const mode = params.mod === "gun" || params.mod === "pano" ? params.mod : "genis";
  const start = dateOnly(params.baslangic ?? todayIstanbulDateString());
  const days = Array.from({ length: mode === "genis" ? 30 : 1 }, (_, index) => addDays(start, index));
  const end = addDays(start, mode === "genis" ? 30 : 1);
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
      include: { cari: { select: { ad: true, telefon: true, whatsapp: true } } }
    })
  ]);

  const selectedDay = days[0];
  const previousDay = addDays(start, -1);
  const nextDay = addDays(start, 1);
  const roomPlans = rooms.map((room) => {
    const reservation = reservations.find((item) => item.odaId === room.id && overlaps(selectedDay, item));
    return { room, reservation, meta: statusMeta(reservation) };
  });
  const emptyRooms = roomPlans.filter((item) => !item.reservation);
  const checkedInRooms = roomPlans.filter((item) => item.reservation?.durum === "GIRIS_YAPILDI");
  const reservedRooms = roomPlans.filter((item) => item.reservation && item.reservation.durum !== "GIRIS_YAPILDI");
  const checkoutRooms = roomPlans.filter((item) => item.reservation && isoDate(item.reservation.cikisTarihi) === isoDate(selectedDay));

  return (
    <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/doluluk">
      <div className="grid gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Doluluk Takvimi</h1>
            <p className="mt-1 text-sm text-muted">Geniş plan, gün listesi ve resepsiyon panosu.</p>
          </div>
          <form action="/doluluk" className="flex flex-wrap items-center justify-end gap-2">
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
            <select className="h-9 rounded-md border border-border bg-white px-3 text-sm" name="mod" defaultValue={mode}>
              <option value="genis">Geniş görünüm</option>
              <option value="gun">Gün görünümü</option>
              <option value="pano">Pano görünümü</option>
            </select>
            <button className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white" type="submit">
              Göster
            </button>
          </form>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Link className="rounded-md border border-border px-3 py-2 hover:bg-accentSoft" href={modeHref("genis", selectedHotel.id, selectedFloorId, start)}>
              Geniş görünüm
            </Link>
            <Link className="rounded-md border border-border px-3 py-2 hover:bg-accentSoft" href={modeHref("gun", selectedHotel.id, selectedFloorId, start)}>
              Gün görünümü
            </Link>
            <Link className="rounded-md border border-border px-3 py-2 hover:bg-accentSoft" href={modeHref("pano", selectedHotel.id, selectedFloorId, start)}>
              Pano görünümü
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-emerald-100 ring-1 ring-emerald-200" />
              Boş
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-amber-100 ring-1 ring-amber-200" />
              Rezerve/Beklemede
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-red-100 ring-1 ring-red-200" />
              Dolu
            </span>
          </div>
        </div>

        {mode === "genis" ? (
          <section className="overflow-hidden rounded-md border border-border bg-surface shadow-table">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-semibold">30 Günlük Geniş Plan</h2>
              <p className="mt-1 text-sm text-muted">Boş hücreler yeni rezervasyon formuna gider. Dolu hücrelerde cari ve tarih bilgisi görünür.</p>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              <table className="min-w-[1760px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-30 w-36 border-b border-r border-border bg-[#eef3f6] px-3 py-3 text-left text-xs uppercase text-muted">
                      Oda
                    </th>
                    {days.map((day) => (
                      <th key={isoDate(day)} className="sticky top-0 z-20 w-14 border-b border-border bg-[#eef3f6] px-2 py-3 text-center">
                        <div className="font-semibold text-foreground">{new Intl.DateTimeFormat("tr-TR", { day: "2-digit" }).format(day)}</div>
                        <div className="text-[11px] uppercase text-muted">{new Intl.DateTimeFormat("tr-TR", { month: "short" }).format(day)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.id} className="border-t border-border">
                      <td className="sticky left-0 z-10 border-b border-r border-border bg-surface px-3 py-3">
                        <div className="font-semibold">{room.odaNo}</div>
                        <div className="text-xs text-muted">{room.kat.ad}</div>
                        <div className="text-xs text-muted">{room.kapasite} kişi</div>
                      </td>
                      {days.map((day) => {
                        const reservation = reservations.find((item) => item.odaId === room.id && overlaps(day, item));
                        const meta = statusMeta(reservation);
                        return (
                          <td key={isoDate(day)} className="border-b border-border p-1 align-middle">
                            {reservation ? (
                              <div className={`h-10 rounded-sm border px-1.5 py-1 text-center text-[11px] leading-tight ${meta.cellClass}`}>
                                <div className="font-semibold">{meta.shortLabel}</div>
                                <div className="truncate" title={reservation.cari.ad}>
                                  {reservation.cari.ad}
                                </div>
                              </div>
                            ) : (
                              <Link
                                className={`block h-10 rounded-sm border px-1.5 py-2 text-center text-[11px] ${meta.cellClass}`}
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
        ) : mode === "gun" ? (
          <section className="grid gap-4">
            <div className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3">
              <Link className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accentSoft" href={modeHref("gun", selectedHotel.id, selectedFloorId, previousDay)}>
                Önceki gün
              </Link>
              <div className="text-center">
                <h2 className="text-xl font-semibold">{dayKey(selectedDay)}</h2>
                <p className="text-sm text-muted">{formatDateTR(selectedDay)}</p>
              </div>
              <Link className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accentSoft" href={modeHref("gun", selectedHotel.id, selectedFloorId, nextDay)}>
                Sonraki gün
              </Link>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rooms.map((room) => {
                const reservation = reservations.find((item) => item.odaId === room.id && overlaps(selectedDay, item));
                const meta = statusMeta(reservation);
                return (
                  <article key={room.id} className={`rounded-md border p-4 ${meta.cardClass}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase opacity-75">{room.kat.ad}</div>
                        <h3 className="mt-1 text-xl font-semibold">Oda {room.odaNo}</h3>
                        <p className="text-sm opacity-80">
                          {room.odaTipi ?? "Oda"} · {room.kapasite} kişi
                        </p>
                      </div>
                      <span className="rounded-md bg-white/70 px-2 py-1 text-sm font-semibold">{meta.label}</span>
                    </div>

                    {reservation ? (
                      <div className="mt-4 grid gap-1 text-sm">
                        <div className="font-medium">{reservation.cari.ad}</div>
                        <div>
                          {formatDateTR(reservation.girisTarihi)} - {formatDateTR(reservation.cikisTarihi)}
                        </div>
                        <div>{reservation.kisiSayisi} kişi</div>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <Link
                          className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-white"
                          href={`/rezervasyonlar/yeni?otelId=${selectedHotel.id}&odaId=${room.id}&tarih=${isoDate(selectedDay)}`}
                        >
                          Bu güne rezervasyon ekle
                        </Link>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="grid gap-4">
            <div className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3">
              <Link className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accentSoft" href={modeHref("pano", selectedHotel.id, selectedFloorId, previousDay)}>
                Önceki gün
              </Link>
              <div className="text-center">
                <h2 className="text-xl font-semibold">Operasyon Panosu</h2>
                <p className="text-sm text-muted">
                  {dayKey(selectedDay)} · {selectedHotel.ad}
                </p>
              </div>
              <Link className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accentSoft" href={modeHref("pano", selectedHotel.id, selectedFloorId, nextDay)}>
                Sonraki gün
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-md border border-border bg-white px-4 py-3">
                <div className="text-sm text-muted">Toplam oda</div>
                <div className="mt-1 text-2xl font-semibold">{rooms.length}</div>
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                <div className="text-sm">Boş</div>
                <div className="mt-1 text-2xl font-semibold">{emptyRooms.length}</div>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                <div className="text-sm">Rezerve/Bekleyen</div>
                <div className="mt-1 text-2xl font-semibold">{reservedRooms.length}</div>
              </div>
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-800">
                <div className="text-sm">İçeride</div>
                <div className="mt-1 text-2xl font-semibold">{checkedInRooms.length}</div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-4">
              {[
                { title: "Bugün Çıkış", items: checkoutRooms, tone: "border-sky-200 bg-sky-50" },
                { title: "İçeride", items: checkedInRooms, tone: "border-red-200 bg-red-50" },
                { title: "Bekleyen / Rezerve", items: reservedRooms, tone: "border-amber-200 bg-amber-50" },
                { title: "Boş Odalar", items: emptyRooms, tone: "border-emerald-200 bg-emerald-50" }
              ].map((column) => (
                <div key={column.title} className={`min-h-[520px] rounded-md border ${column.tone} p-3`}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{column.title}</h3>
                    <span className="rounded-md bg-white/80 px-2 py-1 text-xs font-semibold">{column.items.length}</span>
                  </div>
                  <div className="grid gap-3">
                    {column.items.length === 0 ? (
                      <div className="rounded-md border border-dashed border-border bg-white/70 px-3 py-6 text-center text-sm text-muted">Kayıt yok</div>
                    ) : (
                      column.items.map(({ room, reservation, meta }) => (
                        <article key={`${column.title}-${room.id}`} className="rounded-md border border-border bg-white p-3 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-xs font-medium uppercase text-muted">{room.kat.ad}</div>
                              <h4 className="mt-1 text-lg font-semibold">Oda {room.odaNo}</h4>
                              <div className="text-xs text-muted">
                                {room.odaTipi ?? "Oda"} · {room.kapasite} kişi
                              </div>
                            </div>
                            <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${meta.cellClass}`}>{meta.label}</span>
                          </div>

                          {reservation ? (
                            <div className="mt-3 grid gap-1 text-sm">
                              <div className="font-medium">{reservation.cari.ad}</div>
                              <div className="text-muted">
                                {formatDateTR(reservation.girisTarihi)} - {formatDateTR(reservation.cikisTarihi)}
                              </div>
                              <div className="text-muted">{reservation.kisiSayisi} kişi</div>
                              <div className="truncate text-xs text-muted">
                                {reservation.cari.whatsapp || reservation.cari.telefon || "İletişim yok"}
                              </div>
                            </div>
                          ) : (
                            <Link
                              className="mt-3 inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-medium text-white"
                              href={`/rezervasyonlar/yeni?otelId=${selectedHotel.id}&odaId=${room.id}&tarih=${isoDate(selectedDay)}`}
                            >
                              Hızlı rezervasyon
                            </Link>
                          )}
                        </article>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
