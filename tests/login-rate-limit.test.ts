import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    kullanici: {
      findUnique: vi.fn()
    }
  },
  verifyPassword: vi.fn(),
  createSessionToken: vi.fn(),
  cookies: vi.fn()
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma
}));

vi.mock("@/lib/password", () => ({
  verifyPassword: mocks.verifyPassword
}));

vi.mock("@/lib/session", () => ({
  SESSION_COOKIE: "oys_oturum",
  createSessionToken: mocks.createSessionToken
}));

import { POST as login } from "../app/api/auth/login/route";

function loginRequest(username: string, password: string) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10"
    },
    body: JSON.stringify({ kullaniciAdi: username, sifre: password })
  });
}

describe("login rate limit", () => {
  it("ayni IP ve kullanici adi icin 6. basarisiz denemeyi 429 ile engeller", async () => {
    mocks.prisma.kullanici.findUnique.mockResolvedValue({
      id: 1,
      adSoyad: "Test Kullanıcı",
      kullaniciAdi: "admin",
      rol: "SUPER_ADMIN",
      aktifMi: true,
      sifreHash: "hash"
    });
    mocks.verifyPassword.mockResolvedValue(false);

    for (let index = 0; index < 5; index += 1) {
      const response = await login(loginRequest("admin", "yanlis"));
      expect(response.status).toBe(401);
    }

    const blocked = await login(loginRequest("admin", "yanlis"));
    const body = await blocked.json();

    expect(blocked.status).toBe(429);
    expect(body.message).toContain("Çok fazla başarısız giriş denemesi");
  });

  it("limit doluyken dogru sifreyle girisi engellemez ve sayaci sifirlar", async () => {
    const cookieStore = { set: vi.fn() };
    mocks.cookies.mockResolvedValue(cookieStore);
    mocks.createSessionToken.mockResolvedValue("token");
    mocks.prisma.kullanici.findUnique.mockResolvedValue({
      id: 2,
      adSoyad: "Diğer Admin",
      kullaniciAdi: "otheradmin",
      rol: "SUPER_ADMIN",
      aktifMi: true,
      sifreHash: "hash"
    });

    mocks.verifyPassword.mockResolvedValueOnce(false);
    mocks.verifyPassword.mockResolvedValueOnce(false);
    mocks.verifyPassword.mockResolvedValueOnce(false);
    mocks.verifyPassword.mockResolvedValueOnce(false);
    mocks.verifyPassword.mockResolvedValueOnce(false);
    for (let index = 0; index < 5; index += 1) {
      const response = await login(loginRequest("otheradmin", "yanlis"));
      expect(response.status).toBe(401);
    }

    mocks.verifyPassword.mockResolvedValueOnce(true);
    const success = await login(loginRequest("otheradmin", "dogru"));

    expect(success.status).toBe(200);
    expect(cookieStore.set).toHaveBeenCalled();

    mocks.verifyPassword.mockResolvedValueOnce(false);
    const nextFailure = await login(loginRequest("otheradmin", "yanlis"));
    expect(nextFailure.status).toBe(401);
  });
});
