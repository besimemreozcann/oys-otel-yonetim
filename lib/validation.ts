import { z } from "zod";

export const MAX_TUTAR = 999_999_999.99;
export const MAX_TUTAR_CENTS = 99_999_999_999;

export const tutarSchema = z
  .number()
  .positive("Tutar sıfırdan büyük olmalıdır.")
  .max(MAX_TUTAR, "Tutar çok büyük.");

export function validateTutarCents(cents: number, label = "Tutar") {
  if (!Number.isSafeInteger(cents)) {
    return `${label} geçerli değil.`;
  }
  if (cents <= 0) {
    return `${label} sıfırdan büyük olmalıdır.`;
  }
  if (cents > MAX_TUTAR_CENTS) {
    return `${label} çok büyük.`;
  }
  return null;
}

export function sanitizeExcelCell(value: string | number) {
  if (typeof value !== "string") return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
