import { z } from "zod";
import { jsonError, requireApiHotelPermission, requireApiSession } from "@/lib/api";
import { formatDateTR, formatMoneyTR } from "@/lib/faz3";
import type { ReportType } from "@/lib/reports";

export const reportRequestSchema = z.object({
  raporTuru: z.enum(["doluluk", "cari-ekstre", "gelir-gider", "denetim"]),
  otelId: z.coerce.number().int().positive().optional(),
  katId: z.coerce.number().int().positive().optional(),
  cariId: z.coerce.number().int().positive().optional(),
  hesapId: z.coerce.number().int().positive().optional(),
  kullaniciId: z.coerce.number().int().positive().optional(),
  islemTuru: z.string().trim().optional(),
  baslangic: z.string().min(1),
  bitis: z.string().min(1)
});

export type ReportRequest = z.infer<typeof reportRequestSchema>;

export async function requireReportExportPermission(data: ReportRequest) {
  if (data.raporTuru === "cari-ekstre" && !data.cariId) {
    return jsonError("Cari ekstre raporu icin cari secimi zorunludur.", 400);
  }
  if (data.raporTuru === "gelir-gider" && !data.otelId) {
    return jsonError("Gelir-gider raporu icin otel secimi zorunludur.", 400);
  }
  if (data.raporTuru === "doluluk" && !data.otelId) {
    return jsonError("Doluluk raporu icin otel secimi zorunludur.", 400);
  }

  if (data.raporTuru === "denetim") {
    const { error, session } = await requireApiSession();
    if (error || !session) return error;
    if (session.rol !== "SUPER_ADMIN") return jsonError("Denetim raporu indirmek icin SUPER_ADMIN yetkisi gerekir.", 403);
    return null;
  }

  if (!data.otelId) return jsonError("Rapor icin otel secimi zorunludur.", 400);
  const permission = await requireApiHotelPermission(data.otelId, "rapor", "GORUNTULE");
  return permission.error;
}

export function reportFileName(type: ReportType, extension: "pdf" | "xlsx") {
  return `${type}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

export function reportSheetName(type: ReportType) {
  const names: Record<ReportType, string> = {
    "doluluk": "Doluluk",
    "cari-ekstre": "Cari Ekstre",
    "gelir-gider": "Gelir Gider",
    denetim: "Denetim"
  };
  return names[type];
}

type TableData = {
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  summary?: string[];
};

export function reportToTable(type: ReportType, payload: any): TableData {
  if (type === "doluluk") {
    return {
      title: `${payload.title} - ${payload.hotelName}`,
      headers: ["Tarih", "Toplam Oda", "Dolu", "Rezerve", "Bos", "Doluluk %"],
      rows: payload.rows.map((row: any) => [row.tarih, row.toplamOda, row.dolu, row.rezerve, row.bos, `%${row.doluluk}`])
    };
  }

  if (type === "cari-ekstre") {
    return {
      title: `${payload.title} - ${payload.cariName}`,
      headers: ["Tarih", "Otel/Oda", "Kisi", "Islem", "Borc", "Alacak", "Bakiye"],
      rows: payload.rows.map((row: any) => [
        formatDateTR(row.tarih),
        row.otelOda,
        row.kisi ?? "-",
        row.islem,
        formatMoneyTR(row.borc),
        formatMoneyTR(row.alacak),
        formatMoneyTR(row.bakiye)
      ]),
      summary: [
        `Toplam Borc: ${formatMoneyTR(payload.summary.toplamBorc)}`,
        `Toplam Alacak: ${formatMoneyTR(payload.summary.toplamAlacak)}`,
        `Bakiye: ${formatMoneyTR(payload.summary.bakiye)}`
      ]
    };
  }

  if (type === "gelir-gider") {
    return {
      title: payload.title,
      headers: ["Tarih", "Islem", "Hesap", "Kategori", "Gelir", "Gider", "Aciklama"],
      rows: payload.rows.map((row: any) => [
        formatDateTR(row.tarih),
        row.islem,
        row.hesap,
        row.kategori,
        row.gelir === "0.00" ? "-" : formatMoneyTR(row.gelir),
        row.gider === "0.00" ? "-" : formatMoneyTR(row.gider),
        row.aciklama
      ]),
      summary: [
        `Toplam Gelir: ${formatMoneyTR(payload.summary.toplamGelir)}`,
        `Toplam Gider: ${formatMoneyTR(payload.summary.toplamGider)}`,
        `Net: ${formatMoneyTR(payload.summary.net)}`
      ]
    };
  }

  return {
    title: payload.title,
    headers: ["Tarih/Saat", "Kullanici", "Otel", "Islem", "Tablo", "Kayit", "Aciklama"],
    rows: payload.rows.map((row: any) => [
      formatDateTR(row.tarihSaat),
      row.kullanici,
      row.otel,
      row.islemTuru,
      row.tablo,
      row.kayitId,
      row.aciklama
    ])
  };
}
