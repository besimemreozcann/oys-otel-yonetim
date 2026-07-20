import { AppShell } from "@/components/app-shell";
import { ExportButtons } from "@/components/raporlar/export-buttons";
import { DolulukReportChart } from "@/components/raporlar/report-charts";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { hasHotelPermission } from "@/lib/authz";
import { buildDolulukReport, defaultEnd, defaultStart } from "@/lib/reports";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

type PageProps = {
  searchParams: Promise<{ otelId?: string; katId?: string; baslangic?: string; bitis?: string }>;
};

export default async function DolulukRaporuPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const [allHotels, permissions] = await Promise.all([
    prisma.otel.findMany({ where: { silindiMi: false, aktifMi: true }, orderBy: { ad: "asc" } }),
    prisma.kullaniciOtelYetkisi.findMany({ where: { kullaniciId: session.id } })
  ]);
  const visibleHotels = session.rol === "SUPER_ADMIN" ? allHotels : allHotels.filter((hotel) => permissions.some((permission) => permission.otelId === hotel.id));
  const selectedHotel = visibleHotels.find((hotel) => hotel.id === Number(params.otelId)) ?? visibleHotels[0] ?? null;
  if (!selectedHotel) return <AppShell hotelSelectorAction="/raporlar/doluluk"><section className="rounded-md border border-border bg-surface p-4">Yetkili otel bulunamadı.</section></AppShell>;
  const decision = hasHotelPermission(session, permissions, selectedHotel.id, "rapor", "GORUNTULE");
  if (!decision.allowed) return <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/raporlar/doluluk"><section className="rounded-md border border-border bg-surface p-4">Rapor görüntüleme yetkiniz yok.</section></AppShell>;

  const baslangic = params.baslangic ?? defaultStart(30);
  const bitis = params.bitis ?? defaultEnd();
  const katId = params.katId ? Number(params.katId) : undefined;
  const [floors, report] = await Promise.all([
    prisma.kat.findMany({ where: { otelId: selectedHotel.id }, orderBy: [{ sira: "asc" }, { ad: "asc" }] }),
    buildDolulukReport({ otelId: selectedHotel.id, baslangic, bitis, katId })
  ]);

  return (
    <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/raporlar/doluluk">
      <div className="grid gap-6">
        <div>
          <div className="text-sm text-muted">Raporlar &gt; Doluluk</div>
          <h1 className="mt-1 text-2xl font-semibold">Doluluk Raporu</h1>
        </div>
        <form action="/raporlar/doluluk" className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface p-4">
          <label className="grid gap-1 text-sm">Otel<Select name="otelId" defaultValue={selectedHotel.id}>{visibleHotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.ad}</option>)}</Select></label>
          <label className="grid gap-1 text-sm">Kat<Select name="katId" defaultValue={katId ?? ""}><option value="">Tüm Katlar</option>{floors.map((floor) => <option key={floor.id} value={floor.id}>{floor.ad}</option>)}</Select></label>
          <label className="grid gap-1 text-sm">Başlangıç<input className="h-9 rounded-md border border-border px-3 text-sm" name="baslangic" type="date" defaultValue={baslangic} /></label>
          <label className="grid gap-1 text-sm">Bitiş<input className="h-9 rounded-md border border-border px-3 text-sm" name="bitis" type="date" defaultValue={bitis} /></label>
          <Button type="submit">Filtrele</Button>
          <ExportButtons filters={{ otelId: selectedHotel.id, katId, baslangic, bitis }} reportType="doluluk" />
        </form>
        <DolulukReportChart rows={report.rows} />
        <section className="rounded-md border border-border bg-surface p-4">
          <h2 className="text-lg font-semibold">Günlük Doluluk</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#eef3f6] text-left text-xs uppercase text-muted"><tr><th className="px-3 py-2">Tarih</th><th>Toplam Oda</th><th>Dolu</th><th>Rezerve</th><th>Boş</th><th>Doluluk %</th></tr></thead>
              <tbody>{report.rows.map((row) => <tr key={row.tarih} className="border-t border-border"><td className="px-3 py-2">{row.tarih}</td><td>{row.toplamOda}</td><td>{row.dolu}</td><td>{row.rezerve}</td><td>{row.bos}</td><td>%{row.doluluk}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
        <section className="rounded-md border border-border bg-surface p-4">
          <h2 className="text-lg font-semibold">Oda Bazlı Özet</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#eef3f6] text-left text-xs uppercase text-muted"><tr><th className="px-3 py-2">Oda No</th><th>Kat</th><th>Tip</th><th>Dolu Gün</th><th>Boş Gün</th><th>Doluluk %</th></tr></thead>
              <tbody>{report.roomRows.map((row) => <tr key={row.odaNo} className="border-t border-border"><td className="px-3 py-2">{row.odaNo}</td><td>{row.kat}</td><td>{row.tip}</td><td>{row.doluGun}</td><td>{row.bosGun}</td><td>%{row.doluluk}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
