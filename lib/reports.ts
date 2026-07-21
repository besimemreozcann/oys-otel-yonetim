import type { CariHareketTuru, HesapHareketTuru, Prisma } from "@prisma/client";
import { CARI_HAREKET_TUR_LABELS, ODEME_YONTEMI_LABELS, centsToDecimalString, dateOnly, decimalToCents, formatDateTR } from "@/lib/faz3";
import { HESAP_HAREKET_TURU_LABELS, calculateAccountBalanceCents, hesapHareketYon } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

export type ReportType = "doluluk" | "cari-ekstre" | "gelir-gider" | "denetim";
export const MAX_REPORT_RANGE_DAYS = 366;

export function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function defaultStart(daysBack: number) {
  return isoDate(addDays(dateOnly(new Date()), -daysBack));
}

export function defaultEnd() {
  return isoDate(dateOnly(new Date()));
}

export function validateReportDateRange(baslangic: string, bitis: string) {
  const start = dateOnly(baslangic);
  const end = dateOnly(bitis);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Rapor tarihlerini kontrol edin.";
  }
  if (end < start) {
    return "Bitiş tarihi başlangıç tarihinden önce olamaz.";
  }
  const rangeDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (rangeDays > MAX_REPORT_RANGE_DAYS) {
    return "Rapor tarih aralığı en fazla 1 yıl olabilir. Lütfen aralığı daraltın.";
  }
  return null;
}

export function enumerateDays(startText: string, endText: string) {
  const start = dateOnly(startText);
  const end = dateOnly(endText);
  const days: Date[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

export function cariMovementLabel(tur: CariHareketTuru | string, odemeYontemi?: keyof typeof ODEME_YONTEMI_LABELS | null) {
  if (tur === "TAHSILAT" && odemeYontemi) return `Tahsilat (${ODEME_YONTEMI_LABELS[odemeYontemi]})`;
  return CARI_HAREKET_TUR_LABELS[tur as keyof typeof CARI_HAREKET_TUR_LABELS] ?? tur;
}

function overlaps(day: Date, reservation: { girisTarihi: Date; cikisTarihi: Date }) {
  const next = addDays(day, 1);
  return reservation.girisTarihi < next && reservation.cikisTarihi > day;
}

export async function buildDolulukReport(input: { otelId: number; baslangic: string; bitis: string; katId?: number }) {
  const days = enumerateDays(input.baslangic, input.bitis);
  const endExclusive = addDays(dateOnly(input.bitis), 1);
  const [otel, rooms, reservations] = await Promise.all([
    prisma.otel.findUnique({ where: { id: input.otelId }, select: { ad: true } }),
    prisma.oda.findMany({
      where: { otelId: input.otelId, silindiMi: false, aktifMi: true, ...(input.katId ? { katId: input.katId } : {}) },
      include: { kat: { select: { ad: true } } },
      orderBy: [{ kat: { sira: "asc" } }, { odaNo: "asc" }]
    }),
    prisma.rezervasyon.findMany({
      where: {
        otelId: input.otelId,
        silindiMi: false,
        durum: { in: ["BEKLEMEDE", "ONAYLANDI", "GIRIS_YAPILDI"] },
        girisTarihi: { lt: endExclusive },
        cikisTarihi: { gt: dateOnly(input.baslangic) },
        ...(input.katId ? { oda: { katId: input.katId } } : {})
      }
    })
  ]);

  const rows = days.map((day) => {
    const active = reservations.filter((reservation) => overlaps(day, reservation));
    const distinctRooms = new Set(active.map((reservation) => reservation.odaId));
    const dolu = new Set(active.filter((reservation) => reservation.durum === "GIRIS_YAPILDI").map((reservation) => reservation.odaId)).size;
    const rezerve = distinctRooms.size - dolu;
    const bos = Math.max(rooms.length - distinctRooms.size, 0);
    return {
      tarih: isoDate(day),
      toplamOda: rooms.length,
      dolu,
      rezerve,
      bos,
      doluluk: rooms.length ? Math.round((distinctRooms.size / rooms.length) * 100) : 0
    };
  });

  const roomRows = rooms.map((room) => {
    const doluGun = days.filter((day) => reservations.some((reservation) => reservation.odaId === room.id && overlaps(day, reservation))).length;
    const bosGun = Math.max(days.length - doluGun, 0);
    return {
      odaNo: room.odaNo,
      kat: room.kat.ad,
      tip: room.odaTipi ?? "Oda",
      doluGun,
      bosGun,
      doluluk: days.length ? Math.round((doluGun / days.length) * 100) : 0
    };
  });

  return { title: "Doluluk Raporu", hotelName: otel?.ad ?? "Otel", rows, roomRows };
}

export async function buildCariEkstreReport(input: { otelId?: number; cariId: number; baslangic: string; bitis: string }) {
  const cari = await prisma.cari.findUnique({ where: { id: input.cariId }, select: { ad: true } });
  const movements = await prisma.cariHareket.findMany({
    where: {
      cariId: input.cariId,
      silindiMi: false,
      ...(input.otelId ? { otelId: input.otelId } : {}),
      tarih: { gte: dateOnly(input.baslangic), lte: addDays(dateOnly(input.bitis), 1) }
    },
    include: { otel: { select: { ad: true } }, rezervasyon: { include: { oda: { select: { odaNo: true } } } } },
    orderBy: { tarih: "asc" }
  });
  let balance = 0;
  let totalDebt = 0;
  let totalCredit = 0;
  const rows = movements.map((movement) => {
    const debt = decimalToCents(movement.borc);
    const credit = decimalToCents(movement.alacak);
    totalDebt += debt;
    totalCredit += credit;
    balance += debt - credit;
    return {
      tarih: movement.tarih.toISOString(),
      otelOda: `${movement.otel.ad}${movement.rezervasyon ? ` / ${movement.rezervasyon.oda.odaNo}` : ""}`,
      kisi: movement.rezervasyon?.kisiSayisi ?? null,
      islem: cariMovementLabel(movement.tur, movement.odemeYontemi),
      borc: movement.borc.toString(),
      alacak: movement.alacak.toString(),
      bakiye: centsToDecimalString(balance)
    };
  });
  return {
    title: "Cari Ekstre",
    cariName: cari?.ad ?? "Cari",
    rows,
    summary: {
      toplamBorc: centsToDecimalString(totalDebt),
      toplamAlacak: centsToDecimalString(totalCredit),
      bakiye: centsToDecimalString(balance)
    }
  };
}

export async function buildGelirGiderReport(input: { otelId: number; baslangic: string; bitis: string; hesapId?: number }) {
  const movements = await prisma.hesapHareket.findMany({
    where: {
      hesap: { otelId: input.otelId },
      silindiMi: false,
      ...(input.hesapId ? { hesapId: input.hesapId } : {}),
      tarih: { gte: dateOnly(input.baslangic), lte: addDays(dateOnly(input.bitis), 1) }
    },
    include: { hesap: { select: { ad: true } } },
    orderBy: { tarih: "asc" }
  });
  let totalIncome = 0;
  let totalExpense = 0;
  const rows = movements.map((movement) => {
    const cents = decimalToCents(movement.tutar);
    const direction = hesapHareketYon(movement.tur);
    if (direction > 0) totalIncome += cents;
    else totalExpense += cents;
    return {
      tarih: movement.tarih.toISOString(),
      islem: HESAP_HAREKET_TURU_LABELS[movement.tur],
      hesap: movement.hesap.ad,
      kategori: movement.kategori ?? "-",
      gelir: direction > 0 ? centsToDecimalString(cents) : "0.00",
      gider: direction < 0 ? centsToDecimalString(cents) : "0.00",
      aciklama: movement.aciklama ?? "-"
    };
  });
  const daily = new Map<string, { tarih: string; gelir: number; gider: number }>();
  for (const row of rows) {
    const key = row.tarih.slice(0, 10);
    const item = daily.get(key) ?? { tarih: key, gelir: 0, gider: 0 };
    item.gelir += decimalToCents(row.gelir);
    item.gider += decimalToCents(row.gider);
    daily.set(key, item);
  }
  return {
    title: "Gelir-Gider Raporu",
    rows,
    chartRows: Array.from(daily.values()).map((item) => ({ tarih: item.tarih, gelir: item.gelir / 100, gider: item.gider / 100 })),
    summary: {
      toplamGelir: centsToDecimalString(totalIncome),
      toplamGider: centsToDecimalString(totalExpense),
      net: centsToDecimalString(totalIncome - totalExpense)
    }
  };
}

export async function buildDenetimReport(input: { otelId?: number; kullaniciId?: number; islemTuru?: string; baslangic: string; bitis: string; skip?: number; take?: number }) {
  const where: Prisma.IslemLoguWhereInput = {
    ...(input.otelId ? { otelId: input.otelId } : {}),
    ...(input.kullaniciId ? { kullaniciId: input.kullaniciId } : {}),
    ...(input.islemTuru ? { islemTuru: input.islemTuru } : {}),
    tarihSaat: { gte: dateOnly(input.baslangic), lte: addDays(dateOnly(input.bitis), 1) }
  };
  const [rows, total] = await Promise.all([
    prisma.islemLogu.findMany({
      where,
      include: { kullanici: { select: { adSoyad: true, kullaniciAdi: true } }, otel: { select: { ad: true } } },
      orderBy: { tarihSaat: "desc" },
      skip: input.skip ?? 0,
      take: input.take ?? 50
    }),
    prisma.islemLogu.count({ where })
  ]);
  return {
    title: "Denetim Raporu",
    rows: rows.map((row) => ({
      id: row.id,
      tarihSaat: row.tarihSaat.toISOString(),
      kullanici: row.kullanici.adSoyad,
      otel: row.otel?.ad ?? "-",
      islemTuru: row.islemTuru,
      tablo: row.tablo,
      kayitId: row.kayitId,
      aciklama: row.aciklama ?? "-",
      oncekiDeger: row.oncekiDeger,
      yeniDeger: row.yeniDeger
    })),
    total
  };
}

export async function getReportPayload(type: ReportType, filters: Record<string, string | number | undefined>) {
  if (type === "doluluk") {
    return buildDolulukReport({
      otelId: Number(filters.otelId),
      baslangic: String(filters.baslangic),
      bitis: String(filters.bitis),
      katId: filters.katId ? Number(filters.katId) : undefined
    });
  }
  if (type === "cari-ekstre") {
    return buildCariEkstreReport({
      otelId: filters.otelId ? Number(filters.otelId) : undefined,
      cariId: Number(filters.cariId),
      baslangic: String(filters.baslangic),
      bitis: String(filters.bitis)
    });
  }
  if (type === "gelir-gider") {
    return buildGelirGiderReport({
      otelId: Number(filters.otelId),
      baslangic: String(filters.baslangic),
      bitis: String(filters.bitis),
      hesapId: filters.hesapId ? Number(filters.hesapId) : undefined
    });
  }
  return buildDenetimReport({
    otelId: filters.otelId ? Number(filters.otelId) : undefined,
    kullaniciId: filters.kullaniciId ? Number(filters.kullaniciId) : undefined,
    islemTuru: filters.islemTuru ? String(filters.islemTuru) : undefined,
    baslangic: String(filters.baslangic),
    bitis: String(filters.bitis),
    skip: filters.skip ? Number(filters.skip) : 0,
    take: filters.take ? Number(filters.take) : 50
  });
}

export function reportRangeLabel(start: string, end: string) {
  return `${formatDateTR(start)} - ${formatDateTR(end)}`;
}
