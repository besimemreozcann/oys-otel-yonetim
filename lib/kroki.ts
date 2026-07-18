import type { OdaOperasyonDurumu, Rol } from "@prisma/client";
import type { PermissionRow } from "@/lib/authz";

export const KROKI_WIDTH = 1200;
export const KROKI_HEIGHT = 800;
export const ROOM_DEFAULT_WIDTH = 100;
export const ROOM_DEFAULT_HEIGHT = 80;
export const ROOM_MIN_WIDTH = 60;
export const ROOM_MIN_HEIGHT = 50;
export const ROOM_MAX_WIDTH = 200;
export const ROOM_MAX_HEIGHT = 160;

export const STATUS_COLORS: Record<OdaOperasyonDurumu, string> = {
  BOS: "#4ADE80",
  DOLU: "#EF4444",
  REZERVE: "#FBBF24",
  BAKIM: "#F97316",
  TEMIZLIK: "#60A5FA"
};

export const STATUS_LABELS: Record<OdaOperasyonDurumu, string> = {
  BOS: "Boş",
  DOLU: "Dolu",
  REZERVE: "Rezerve",
  BAKIM: "Bakım",
  TEMIZLIK: "Temizlik"
};

export type AuthzSubject = {
  id: number;
  rol: Rol;
};

export type RoomPositionInput = {
  id: number;
  krokiX: number | null;
  krokiY: number | null;
  krokiGenislik: number | null;
  krokiYukseklik: number | null;
};

export function hasHotelAccess(user: AuthzSubject, permissions: PermissionRow[], otelId: number) {
  return user.rol === "SUPER_ADMIN" || permissions.some((permission) => permission.otelId === otelId);
}

export function clampRoomPosition(input: RoomPositionInput): RoomPositionInput {
  if (
    input.krokiX === null ||
    input.krokiY === null ||
    input.krokiGenislik === null ||
    input.krokiYukseklik === null
  ) {
    return {
      id: input.id,
      krokiX: null,
      krokiY: null,
      krokiGenislik: null,
      krokiYukseklik: null
    };
  }

  const width = Math.max(ROOM_MIN_WIDTH, Math.min(input.krokiGenislik, ROOM_MAX_WIDTH));
  const height = Math.max(ROOM_MIN_HEIGHT, Math.min(input.krokiYukseklik, ROOM_MAX_HEIGHT));
  const x = Math.max(0, Math.min(input.krokiX, KROKI_WIDTH - width));
  const y = Math.max(0, Math.min(input.krokiY, KROKI_HEIGHT - height));

  return {
    id: input.id,
    krokiX: Math.round(x),
    krokiY: Math.round(y),
    krokiGenislik: Math.round(width),
    krokiYukseklik: Math.round(height)
  };
}

export function hasDuplicateRoomIds(items: RoomPositionInput[]) {
  return new Set(items.map((item) => item.id)).size !== items.length;
}

export function generatedKrokiSvg(otelAd: string, katAd: string) {
  return `<svg viewBox="0 0 ${KROKI_WIDTH} ${KROKI_HEIGHT}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${otelAd} ${katAd} krokisi"></svg>`;
}
