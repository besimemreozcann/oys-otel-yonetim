import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateBalanceCents, centsToDecimalString } from "@/lib/faz3";
import { intParam, jsonError, prismaErrorResponse, requireApiHotelPermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const cariSchema = z.object({
  otelId: z.number().int().positive(),
  ad: z.string().min(2),
  tur: z.enum(["TUR_SIRKETI", "ACENTE", "KURUMSAL", "TEDARIKCI", "BIREYSEL"]),
  vergiNo: z.string().optional().nullable(),
  vergiDairesi: z.string().optional().nullable(),
  adres: z.string().optional().nullable(),
  telefon: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  eposta: z.string().email().optional().nullable().or(z.literal("")),
  aktifMi: z.boolean().optional()
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let otelId: number;
  try {
    otelId = intParam(searchParams.get("otelId"), "Otel");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Otel geçerli değil.", 400);
  }

  const permission = await requireApiHotelPermission(otelId, "cari", "GORUNTULE");
  if (permission.error) return permission.error;

  const tur = searchParams.get("tur");
  const aktif = searchParams.get("aktif");
  const q = searchParams.get("q")?.trim();

  const cariler = await prisma.cari.findMany({
    where: {
      silindiMi: false,
      ...(tur ? { tur: tur as any } : {}),
      ...(aktif === "true" ? { aktifMi: true } : aktif === "false" ? { aktifMi: false } : {}),
      ...(q ? { ad: { contains: q, mode: "insensitive" } } : {})
    },
    include: {
      hareketler: { where: { silindiMi: false }, orderBy: { tarih: "desc" } }
    },
    orderBy: { ad: "asc" }
  });

  return NextResponse.json({
    cariler: cariler.map((cari) => ({
      id: cari.id,
      ad: cari.ad,
      tur: cari.tur,
      telefon: cari.telefon,
      whatsapp: cari.whatsapp,
      eposta: cari.eposta,
      aktifMi: cari.aktifMi,
      bakiye: centsToDecimalString(calculateBalanceCents(cari.hareketler)),
      sonHareketTarihi: cari.hareketler[0]?.tarih ?? null
    }))
  });
}

export async function POST(request: Request) {
  const parsed = cariSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Cari bilgilerini kontrol edin.", 400);

  const permission = await requireApiHotelPermission(parsed.data.otelId, "cari", "TAM");
  if (permission.error) return permission.error;

  try {
    const cari = await prisma.cari.create({
      data: {
        ad: parsed.data.ad,
        tur: parsed.data.tur,
        vergiNo: parsed.data.vergiNo || null,
        vergiDairesi: parsed.data.vergiDairesi || null,
        adres: parsed.data.adres || null,
        telefon: parsed.data.telefon || null,
        whatsapp: parsed.data.whatsapp || null,
        eposta: parsed.data.eposta || null,
        aktifMi: parsed.data.aktifMi ?? true
      }
    });
    return NextResponse.json({ cari }, { status: 201 });
  } catch (error) {
    return prismaErrorResponse(error) ?? jsonError("Cari oluşturulamadı.", 500);
  }
}
