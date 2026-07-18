import { Building2, Hotel, Users } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

type AppShellProps = {
  children: React.ReactNode;
  selectedHotelId?: number;
  hotelSelectorAction?: string;
};

export async function AppShell({ children, selectedHotelId, hotelSelectorAction = "/dashboard" }: AppShellProps) {
  const session = await requireSession();
  const allHotels = await prisma.otel.findMany({
    where: { silindiMi: false, aktifMi: true },
    orderBy: { ad: "asc" }
  });
  const permissions = await prisma.kullaniciOtelYetkisi.findMany({
    where: { kullaniciId: session.id }
  });
  const visibleHotels =
    session.rol === "SUPER_ADMIN"
      ? allHotels
      : allHotels.filter((hotel) => permissions.some((permission) => permission.otelId === hotel.id));

  const currentHotelId = selectedHotelId ?? visibleHotels[0]?.id;

  return (
    <div className="turkish-proof grid min-h-screen grid-cols-[240px_1fr] bg-background">
      <aside className="bg-sidebar text-white">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">OYS</div>
            <div className="text-xs text-white/65">Çoklu Otel Yönetimi</div>
          </div>
        </div>
        <nav className="space-y-1 p-3 text-sm">
          <Link className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-sidebarMuted" href="/dashboard">
            <Hotel className="h-4 w-4" />
            Ana panel
          </Link>
          <Link className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-sidebarMuted" href="/hotels">
            <Building2 className="h-4 w-4" />
            Otel, kat ve oda
          </Link>
          <Link className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-sidebarMuted" href="/kroki">
            <Hotel className="h-4 w-4" />
            Kroki
          </Link>
          {session.rol === "SUPER_ADMIN" ? (
            <Link className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-sidebarMuted" href="/users">
              <Users className="h-4 w-4" />
              Kullanıcı yönetimi
            </Link>
          ) : null}
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-6">
          {visibleHotels.length ? (
            <form className="flex items-center gap-2" action={hotelSelectorAction}>
              <label className="text-sm font-medium text-muted" htmlFor="otelId">
                Otel
              </label>
              <select
                className="h-9 min-w-64 rounded-md border border-border bg-white px-3 text-sm"
                defaultValue={currentHotelId}
                id="otelId"
                name="otelId"
              >
                {visibleHotels.map((hotel) => (
                  <option key={hotel.id} value={hotel.id}>
                    {hotel.ad}
                  </option>
                ))}
              </select>
              <button className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white" type="submit">
                Seç
              </button>
            </form>
          ) : (
            <div className="text-sm font-medium text-danger">Yetkili otel bulunamadı.</div>
          )}
          <div className="flex items-center gap-3 text-sm">
            <span>
              {session.adSoyad} · {session.rol.replace("_", " ")}
            </span>
            <form action="/api/auth/logout" method="post">
              <button className="rounded-md border border-border px-3 py-2 text-sm" type="submit">
                Çıkış
              </button>
            </form>
          </div>
        </header>
        <main className="p-6">
          {!visibleHotels.length && session.rol !== "SUPER_ADMIN" ? (
            <section className="rounded-md border border-border bg-surface p-4">
              <h1 className="text-xl font-semibold">Yetkili otel bulunamadı</h1>
              <p className="mt-2 text-sm text-muted">
                Bu kullanıcı için aktif bir otel yetkisi yok. Lütfen SUPER_ADMIN kullanıcısından yetki ataması isteyin.
              </p>
            </section>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
