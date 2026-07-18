import { NextResponse } from "next/server";
import { dateOnly } from "@/lib/faz3";
import { intParam, jsonError, requireApiHotelPermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<any>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { id: rawId } = await params;
  const otelId = intParam(rawId, "Otel");
  const { searchParams } = new URL(request.url);
  const giris = searchParams.get("giris");
  const cikis = searchParams.get("cikis");
  if (!giris || !cikis) return jsonError("Giriş ve çıkış tarihleri zorunludur.", 400);

  const permission = await requireApiHotelPermission(otelId, "rezervasyon", "GORUNTULE");
  if (permission.error) return permission.error;

  const rooms = await prisma.oda.findMany({
    where: { otelId, silindiMi: false, aktifMi: true },
    include: {
      kat: { select: { ad: true, sira: true } },
      rezervasyonlar: {
        where: {
          silindiMi: false,
          durum: { not: "IPTAL" },
          girisTarihi: { lt: dateOnly(cikis) },
          cikisTarihi: { gt: dateOnly(giris) }
        },
        select: { id: true, durum: true, girisTarihi: true, cikisTarihi: true }
      }
    },
    orderBy: [{ kat: { sira: "asc" } }, { odaNo: "asc" }]
  });

  return NextResponse.json({
    odalar: rooms.map((room) => ({
      id: room.id,
      odaNo: room.odaNo,
      odaTipi: room.odaTipi,
      kapasite: room.kapasite,
      operasyonDurumu: room.operasyonDurumu,
      kat: room.kat,
      musaitMi: room.rezervasyonlar.length === 0,
      cakisanRezervasyonlar: room.rezervasyonlar
    }))
  });
}
