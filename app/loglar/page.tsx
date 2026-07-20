import { AppShell } from "@/components/app-shell";
import { LogTableClient } from "@/components/logs/log-table-client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { buildDenetimReport, defaultEnd, defaultStart } from "@/lib/reports";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/session";

type PageProps = {
  searchParams: Promise<{ otelId?: string; kullaniciId?: string; islemTuru?: string; baslangic?: string; bitis?: string }>;
};

export default async function LoglarPage({ searchParams }: PageProps) {
  await requireSuperAdmin();
  const params = await searchParams;
  const baslangic = params.baslangic ?? defaultStart(7);
  const bitis = params.bitis ?? defaultEnd();
  const otelId = params.otelId ? Number(params.otelId) : undefined;
  const kullaniciId = params.kullaniciId ? Number(params.kullaniciId) : undefined;
  const islemTuru = params.islemTuru || undefined;
  const [hotels, users, islemTurleri, report] = await Promise.all([
    prisma.otel.findMany({ where: { silindiMi: false }, orderBy: { ad: "asc" } }),
    prisma.kullanici.findMany({ where: { aktifMi: true }, orderBy: { adSoyad: "asc" } }),
    prisma.islemLogu.findMany({ distinct: ["islemTuru"], select: { islemTuru: true }, orderBy: { islemTuru: "asc" } }),
    buildDenetimReport({ otelId, kullaniciId, islemTuru, baslangic, bitis, take: 100 })
  ]);

  return (
    <AppShell selectedHotelId={otelId} hotelSelectorAction="/loglar">
      <div className="grid gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Islem Loglari</h1>
          <p className="mt-1 text-sm text-muted">Sistem genelindeki kritik degisiklikleri izleyin.</p>
        </div>
        <form action="/loglar" className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface p-4">
          <label className="grid gap-1 text-sm">
            Otel
            <Select name="otelId" defaultValue={otelId ?? ""}>
              <option value="">Tum Oteller</option>
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>{hotel.ad}</option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm">
            Kullanici
            <Select name="kullaniciId" defaultValue={kullaniciId ?? ""}>
              <option value="">Tum Kullanicilar</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.adSoyad}</option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm">
            Islem
            <Select name="islemTuru" defaultValue={islemTuru ?? ""}>
              <option value="">Tum Islemler</option>
              {islemTurleri.map((item) => (
                <option key={item.islemTuru} value={item.islemTuru}>{item.islemTuru}</option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm">Baslangic<input className="h-9 rounded-md border border-border px-3 text-sm" name="baslangic" type="date" defaultValue={baslangic} /></label>
          <label className="grid gap-1 text-sm">Bitis<input className="h-9 rounded-md border border-border px-3 text-sm" name="bitis" type="date" defaultValue={bitis} /></label>
          <Button type="submit">Filtrele</Button>
        </form>
        <section className="rounded-md border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Son Kayitlar</h2>
            <span className="text-sm text-muted">Toplam {report.total} kayit</span>
          </div>
          <LogTableClient rows={report.rows} />
        </section>
      </div>
    </AppShell>
  );
}
