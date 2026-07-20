import { NextResponse } from "next/server";
import { z } from "zod";
import { centsToDecimalString } from "@/lib/faz3";
import { calculateAccountBalanceCents } from "@/lib/finance";
import { intParam, jsonError, prismaErrorResponse, requireApiHotelPermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  otelId: z.number().int().positive(),
  tur: z.enum(["NAKIT_KASA", "BANKA"]).optional(),
  ad: z.string().min(2).optional(),
  bankaAdi: z.string().optional().nullable(),
  iban: z.string().optional().nullable(),
  aktifMi: z.boolean().optional()
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function findAccount(id: number, otelId: number) {
  return prisma.hesap.findFirst({
    where: { id, otelId, silindiMi: false },
    include: { hareketler: { where: { silindiMi: false }, select: { tur: true, tutar: true } } }
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id: rawId } = await params;
  const id = intParam(rawId, "Hesap");
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Hesap bilgilerini kontrol edin.", 400);

  const permission = await requireApiHotelPermission(parsed.data.otelId, "finans", "TAM");
  if (permission.error || !permission.session) return permission.error;

  const current = await findAccount(id, parsed.data.otelId);
  if (!current) return jsonError("Hesap bulunamadı.", 404);
  const nextType = parsed.data.tur ?? current.tur;

  try {
    const hesap = await prisma.$transaction(async (tx) => {
      const updated = await tx.hesap.update({
        where: { id },
        data: {
          tur: nextType,
          ad: parsed.data.ad ?? current.ad,
          bankaAdi: nextType === "BANKA" ? parsed.data.bankaAdi ?? current.bankaAdi : null,
          iban: nextType === "BANKA" ? parsed.data.iban ?? current.iban : null,
          aktifMi: parsed.data.aktifMi ?? current.aktifMi
        }
      });

      await tx.islemLogu.create({
        data: {
          kullaniciId: permission.session.id,
          otelId: parsed.data.otelId,
          islemTuru: "FINANS_HESAP_GUNCELLEME",
          tablo: "Hesap",
          kayitId: updated.id,
          oncekiDeger: { ad: current.ad, tur: current.tur, aktifMi: current.aktifMi },
          yeniDeger: { ad: updated.ad, tur: updated.tur, aktifMi: updated.aktifMi },
          aciklama: `Finans hesabı güncellendi: ${updated.ad}`
        }
      });

      return updated;
    });

    return NextResponse.json({ hesap });
  } catch (error) {
    return prismaErrorResponse(error) ?? jsonError("Hesap güncellenemedi.", 500);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { searchParams } = new URL(request.url);
  const { id: rawId } = await params;
  const id = intParam(rawId, "Hesap");
  const otelId = intParam(searchParams.get("otelId"), "Otel");

  const permission = await requireApiHotelPermission(otelId, "finans", "TAM");
  if (permission.error || !permission.session) return permission.error;

  const current = await findAccount(id, otelId);
  if (!current) return jsonError("Hesap bulunamadı.", 404);
  const balanceCents = calculateAccountBalanceCents(current.hareketler);

  const deleted = await prisma.$transaction(async (tx) => {
    const result = await tx.hesap.update({
      where: { id },
      data: { silindiMi: true, silinmeTarihi: new Date(), aktifMi: false }
    });

    await tx.islemLogu.create({
      data: {
        kullaniciId: permission.session.id,
        otelId,
        islemTuru: "FINANS_HESAP_SILME",
        tablo: "Hesap",
        kayitId: id,
        oncekiDeger: { ad: current.ad, bakiye: centsToDecimalString(balanceCents) },
        aciklama: `Finans hesabı silindi: ${current.ad}`
      }
    });

    return result;
  });

  return NextResponse.json({
    hesap: deleted,
    message: balanceCents === 0 ? "Hesap silindi." : "Hesap silindi. Uyarı: hesabın bakiyesi sıfır değildi."
  });
}
