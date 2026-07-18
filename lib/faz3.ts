import { Prisma } from "@prisma/client";

export const CARI_TUR_LABELS = {
  TUR_SIRKETI: "Tur Şirketi",
  ACENTE: "Acente",
  KURUMSAL: "Kurumsal",
  TEDARIKCI: "Tedarikçi",
  BIREYSEL: "Bireysel"
} as const;

export const ILETISIM_TUR_LABELS = {
  ARANDI: "Arandı",
  ULASILAMADI: "Ulaşılamadı",
  GERI_DONUS_BEKLENIYOR: "Geri Dönüş Bekleniyor",
  WHATSAPP: "WhatsApp",
  NOT: "Not"
} as const;

export const REZERVASYON_DURUM_LABELS = {
  BEKLEMEDE: "Beklemede",
  ONAYLANDI: "Onaylandı",
  GIRIS_YAPILDI: "Giriş Yapıldı",
  CIKIS_YAPILDI: "Çıkış Yapıldı",
  IPTAL: "İptal"
} as const;

export function dateOnly(value: string | Date) {
  const date = typeof value === "string" ? new Date(`${value}T00:00:00.000Z`) : value;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function todayIstanbulDateString(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

export function formatDateTR(value: Date | string) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function nightCount(giris: string | Date, cikis: string | Date) {
  const start = dateOnly(giris).getTime();
  const end = dateOnly(cikis).getTime();
  return Math.round((end - start) / 86_400_000);
}

export function decimalToCents(value: Prisma.Decimal | string | number | null | undefined) {
  if (value == null) return 0;
  const text = typeof value === "string" ? value : value.toString();
  const normalized = text.replace(",", ".").trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return 0;
  const negative = normalized.startsWith("-");
  const [wholeRaw, fractionRaw = ""] = normalized.replace("-", "").split(".");
  const cents = Number(wholeRaw) * 100 + Number(fractionRaw.padEnd(2, "0").slice(0, 2));
  return negative ? -cents : cents;
}

export function centsToDecimalString(cents: number) {
  const negative = cents < 0;
  const absolute = Math.abs(Math.round(cents));
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function formatMoneyTR(value: Prisma.Decimal | string | number | null | undefined) {
  const cents = decimalToCents(value);
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(cents / 100) + " ₺";
}

export function calculateBalanceCents(
  movements: Array<{ borc: Prisma.Decimal | string | number; alacak: Prisma.Decimal | string | number }>
) {
  return movements.reduce((total, movement) => total + decimalToCents(movement.borc) - decimalToCents(movement.alacak), 0);
}

export function normalizePhoneForWaMe(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

export function isReservationConflictError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const cause = typeof error.meta?.cause === "string" ? error.meta.cause : "";
    return error.code === "P2010" && (cause.includes("23P01") || cause.includes("rezervasyon_cakisma_engeli"));
  }

  if (error && typeof error === "object") {
    const message = "message" in error && typeof error.message === "string" ? error.message : "";
    const code = "code" in error && typeof error.code === "string" ? error.code : "";
    return code === "23P01" || message.includes("23P01") || message.includes("rezervasyon_cakisma_engeli");
  }

  return false;
}
