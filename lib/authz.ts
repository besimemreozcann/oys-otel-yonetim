import type {
  KullaniciOtelYetkisi,
  Rol,
  YetkiSeviyesiCari,
  YetkiSeviyesiFinans,
  YetkiSeviyesiRapor,
  YetkiSeviyesiRezervasyon
} from "@prisma/client";

export type PermissionDomain = "otel" | "rezervasyon" | "cari" | "finans" | "rapor";

export type PermissionRow = Pick<
  KullaniciOtelYetkisi,
  "otelId" | "rezervasyonYetkisi" | "cariYetkisi" | "finansYetkisi" | "raporYetkisi"
>;

type AuthzUser = {
  id: number;
  rol: Rol;
};

type Decision = {
  allowed: boolean;
  status: 200 | 403;
  message: string;
};

const rezervasyonRank: Record<YetkiSeviyesiRezervasyon, number> = {
  YOK: 0,
  GORUNTULE: 1,
  EKLE: 2,
  TAM: 3
};

const cariRank: Record<YetkiSeviyesiCari, number> = {
  YOK: 0,
  GORUNTULE: 1,
  TAHSILAT: 2,
  TAM: 3
};

const finansRank: Record<YetkiSeviyesiFinans, number> = {
  YOK: 0,
  GORUNTULE: 1,
  SINIRLI: 2,
  TAM: 3
};

const raporRank: Record<YetkiSeviyesiRapor, number> = {
  YOK: 0,
  GORUNTULE: 1,
  TAM: 2
};

export function hasHotelPermission(
  user: AuthzUser,
  permissions: PermissionRow[],
  otelId: number,
  domain: PermissionDomain,
  required = "GORUNTULE"
): Decision {
  if (user.rol === "SUPER_ADMIN") {
    return { allowed: true, status: 200, message: "Erişim onaylandı." };
  }

  const permission = permissions.find((item) => item.otelId === otelId);
  if (!permission) {
    return {
      allowed: false,
      status: 403,
      message: "Bu otele erişim yetkiniz yok."
    };
  }

  if (domain === "otel") {
    if (user.rol === "ADMIN") {
      return { allowed: true, status: 200, message: "Erişim onaylandı." };
    }

    return {
      allowed: false,
      status: 403,
      message: "Otel, kat ve oda yönetimi için yönetici yetkisi gerekir."
    };
  }

  if (domain === "rezervasyon") {
    const requiredLevel = required as YetkiSeviyesiRezervasyon;
    if (rezervasyonRank[permission.rezervasyonYetkisi] >= rezervasyonRank[requiredLevel]) {
      return { allowed: true, status: 200, message: "Erişim onaylandı." };
    }
  }

  if (domain === "cari") {
    const requiredLevel = required as YetkiSeviyesiCari;
    if (cariRank[permission.cariYetkisi] >= cariRank[requiredLevel]) {
      return { allowed: true, status: 200, message: "Erişim onaylandı." };
    }
  }

  if (domain === "finans") {
    const requiredLevel = required as YetkiSeviyesiFinans;
    if (finansRank[permission.finansYetkisi] >= finansRank[requiredLevel]) {
      return { allowed: true, status: 200, message: "Erişim onaylandı." };
    }
  }

  if (domain === "rapor") {
    const requiredLevel = required as YetkiSeviyesiRapor;
    if (raporRank[permission.raporYetkisi] >= raporRank[requiredLevel]) {
      return { allowed: true, status: 200, message: "Erişim onaylandı." };
    }
  }

  return {
    allowed: false,
    status: 403,
    message: "Bu işlem için yetkiniz yok."
  };
}

export function visibleHotelIds(user: AuthzUser, permissions: PermissionRow[], allHotelIds: number[]) {
  if (user.rol === "SUPER_ADMIN") return allHotelIds;
  return permissions.map((permission) => permission.otelId);
}

export function hasAnyCariPermission(
  user: AuthzUser,
  permissions: PermissionRow[],
  required: YetkiSeviyesiCari
): Decision {
  if (user.rol === "SUPER_ADMIN") {
    return { allowed: true, status: 200, message: "Erişim onaylandı." };
  }

  const allowed = permissions.some((permission) => cariRank[permission.cariYetkisi] >= cariRank[required]);
  if (allowed) {
    return { allowed: true, status: 200, message: "Erişim onaylandı." };
  }

  return {
    allowed: false,
    status: 403,
    message: "Bu işlem için cari yetkiniz yok."
  };
}
