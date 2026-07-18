import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateBalanceCents, centsToDecimalString } from "@/lib/faz3";
import { intParam, jsonError, prismaErrorResponse, requireApiHotelPermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const cariSchema = z.object({
  otelId: z.number().int().positive(),
  ad: z.string().min(2).optional(),
  tur: z.enum(["TUR_SIRKETI", "ACENTE", "KURUMSAL", "TEDARIKCI", "BIREYSEL"]).optional(),
  vergiNo: z.string().optional().nullable(),
  vergiDairesi: z.string().optional().nullable(),
  adres: z.string().optional().nullable(),
  telefon: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  eposta: z.string().email().optional().nullable().or(z.literal("")),
  aktifMi: z.boolean().optional()
});

type RouteContext = {
  params: Promise<any>;
};

function cariIdFrom(raw: string) {
  return intParam(raw, "Cari");
}

export async function GET(request: Request, { params }: RouteContext) {
  const { searchParams } = new URL(request.url);
  let otelId: number;
  try {
    otelId = intParam(searchParams.get("otelId"), "Otel");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Otel geçerli değil.", 400);
  }

  const permission = await requireApiHotelPermission(otelId, "cari", "GORUNTULE");
  if (permission.error) return permission.error;

  const { id: rawId } = await params;
  const id = cariIdFrom(rawId);
  const cari = await prisma.cari.findFirst({
    where: { id, silindiMi: false },
    include: {
      yetkililer: true,
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
  if (!cari) return jsonError("Cari bulunamadı.", 404);

  return NextResponse.json({
    cari: {
      ...cari,
      bakiye: centsToDecimalString(calculateBalanceCents(cari.hareketler))
    }
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const parsed = cariSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Cari bilgilerini kontrol edin.", 400);

  const permission = await requireApiHotelPermission(parsed.data.otelId, "cari", "TAM");
  if (permission.error) return permission.error;

  const { id: rawId } = await params;
  const id = cariIdFrom(rawId);

  try {
    const cari = await prisma.cari.update({
      where: { id },
      data: {
        ad: parsed.data.ad,
        tur: parsed.data.tur,
        vergiNo: parsed.data.vergiNo || null,
        vergiDairesi: parsed.data.vergiDairesi || null,
        adres: parsed.data.adres || null,
        telefon: parsed.data.telefon || null,
        whatsapp: parsed.data.whatsapp || null,
        eposta: parsed.data.eposta || null,
        aktifMi: parsed.data.aktifMi
      }
    });
    return NextResponse.json({ cari });
  } catch (error) {
    return prismaErrorResponse(error) ?? jsonError("Cari güncellenemedi.", 500);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { searchParams } = new URL(request.url);
  let otelId: number;
  try {
    otelId = intParam(searchParams.get("otelId"), "Otel");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Otel geçerli değil.", 400);
  }

  const permission = await requireApiHotelPermission(otelId, "cari", "TAM");
  if (permission.error) return permission.error;

  const { id: rawId } = await params;
  const id = cariIdFrom(rawId);

  const [openReservationCount, movements] = await Promise.all([
    prisma.rezervasyon.count({
      where: { cariId: id, silindiMi: false, durum: { in: ["BEKLEMEDE", "ONAYLANDI", "GIRIS_YAPILDI"] } }
    }),
    prisma.cariHareket.findMany({ where: { cariId: id, silindiMi: false }, select: { borc: true, alacak: true } })
  ]);

  const balanceCents = calculateBalanceCents(movements);
  await prisma.cari.update({
    where: { id },
    data: { silindiMi: true, silinmeTarihi: new Date(), aktifMi: false }
  });

  return NextResponse.json({
    ok: true,
    warnings: {
      acikRezervasyonVarMi: openReservationCount > 0,
      bakiyeVarMi: balanceCents !== 0
    }
  });
}
