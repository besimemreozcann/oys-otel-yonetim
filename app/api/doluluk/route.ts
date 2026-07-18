import { NextResponse } from "next/server";
import { dateOnly } from "@/lib/faz3";
import { intParam, jsonError, requireApiHotelPermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let otelId: number;
  try {
    otelId = intParam(searchParams.get("otelId"), "Otel");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Otel geçerli değil.", 400);
  }

  const permission = await requireApiHotelPermission(otelId, "rezervasyon", "GORUNTULE");
  if (permission.error) return permission.error;

  const start = dateOnly(searchParams.get("baslangic") ?? new Date());
  const end = addDays(start, 30);
  const katId = searchParams.get("katId") ? Number(searchParams.get("katId")) : undefined;

  const [rooms, reservations] = await Promise.all([
    prisma.oda.findMany({
      where: { otelId, silindiMi: false, aktifMi: true, ...(katId ? { katId } : {}) },
      include: { kat: { select: { ad: true, sira: true } } },
      orderBy: [{ kat: { sira: "asc" } }, { odaNo: "asc" }]
    }),
    prisma.rezervasyon.findMany({
      where: {
        otelId,
        silindiMi: false,
        durum: { in: ["BEKLEMEDE", "ONAYLANDI", "GIRIS_YAPILDI"] },
        girisTarihi: { lt: end },
        cikisTarihi: { gt: start },
        ...(katId ? { oda: { katId } } : {})
      },
      include: { cari: { select: { ad: true } }, oda: { select: { odaNo: true } } }
    })
  ]);

  return NextResponse.json({ baslangic: start, bitis: end, odalar: rooms, rezervasyonlar: reservations });
}
