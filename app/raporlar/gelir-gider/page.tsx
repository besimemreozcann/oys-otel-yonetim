import { AppShell } from "@/components/app-shell";
import { ExportButtons } from "@/components/raporlar/export-buttons";
import { GelirGiderReportChart } from "@/components/raporlar/report-charts";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { hasHotelPermission } from "@/lib/authz";
import { formatMoneyTR } from "@/lib/faz3";
import { buildGelirGiderReport, defaultEnd, defaultStart } from "@/lib/reports";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

type PageProps = {
  searchParams: Promise<{ otelId?: string; hesapId?: string; baslangic?: string; bitis?: string }>;
};

export default async function GelirGiderRaporuPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const [allHotels, permissions] = await Promise.all([
    prisma.otel.findMany({ where: { silindiMi: false, aktifMi: true }, orderBy: { ad: "asc" } }),
    prisma.kullaniciOtelYetkisi.findMany({ where: { kullaniciId: session.id } })
  ]);
  const visibleHotels = session.rol === "SUPER_ADMIN" ? allHotels : allHotels.filter((hotel) => permissions.some((permission) => permission.otelId === hotel.id));
  const selectedHotel = visibleHotels.find((hotel) => hotel.id === Number(params.otelId)) ?? visibleHotels[0] ?? null;
  if (!selectedHotel) return <AppShell hotelSelectorAction="/raporlar/gelir-gider"><section className="rounded-md border border-border bg-surface p-4">Yetkili otel bulunamadı.</section></AppShell>;
  const decision = hasHotelPermission(session, permissions, selectedHotel.id, "rapor", "GORUNTULE");
  if (!decision.allowed) return <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/raporlar/gelir-gider"><section className="rounded-md border border-border bg-surface p-4">Rapor görüntüleme yetkiniz yok.</section></AppShell>;
  const baslangic = params.baslangic ?? defaultStart(30);
  const bitis = params.bitis ?? defaultEnd();
  const hesapId = params.hesapId ? Number(params.hesapId) : undefined;
  const [hesaplar, report] = await Promise.all([
    prisma.hesap.findMany({ where: { otelId: selectedHotel.id, silindiMi: false }, orderBy: [{ tur: "asc" }, { ad: "asc" }] }),
    buildGelirGiderReport({ otelId: selectedHotel.id, baslangic, bitis, hesapId })
  ]);

  return (
    <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/raporlar/gelir-gider">
      <div className="grid gap-6">
        <div><div className="text-sm text-muted">Raporlar &gt; Gelir-Gider</div><h1 className="mt-1 text-2xl font-semibold">Gelir-Gider Raporu</h1></div>
        <form action="/raporlar/gelir-gider" className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface p-4">
          <label className="grid gap-1 text-sm">Otel<Select name="otelId" defaultValue={selectedHotel.id}>{visibleHotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.ad}</option>)}</Select></label>
          <label className="grid gap-1 text-sm">Hesap<Select name="hesapId" defaultValue={hesapId ?? ""}><option value="">Tüm Hesaplar</option>{hesaplar.map((hesap) => <option key={hesap.id} value={hesap.id}>{hesap.ad}</option>)}</Select></label>
          <label className="grid gap-1 text-sm">Başlangıç<input className="h-9 rounded-md border border-border px-3 text-sm" name="baslangic" type="date" defaultValue={baslangic} /></label>
          <label className="grid gap-1 text-sm">Bitiş<input className="h-9 rounded-md border border-border px-3 text-sm" name="bitis" type="date" defaultValue={bitis} /></label>
          <Button type="submit">Filtrele</Button>
          <ExportButtons filters={{ otelId: selectedHotel.id, hesapId, baslangic, bitis }} reportType="gelir-gider" />
        </form>
        <GelirGiderReportChart rows={report.chartRows} />
        <section className="rounded-md border border-border bg-surface p-4">
          <div className="flex flex-wrap justify-between gap-3"><h2 className="text-lg font-semibold">Hareketler</h2><div className="flex flex-wrap gap-4 text-sm font-semibold"><span>Gelir: {formatMoneyTR(report.summary.toplamGelir)}</span><span>Gider: {formatMoneyTR(report.summary.toplamGider)}</span><span>Net: {formatMoneyTR(report.summary.net)}</span></div></div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#eef3f6] text-left text-xs uppercase text-muted"><tr><th className="px-3 py-2">Tarih</th><th>İşlem</th><th>Hesap</th><th>Kategori</th><th className="text-right">Gelir</th><th className="text-right">Gider</th><th>Açıklama</th></tr></thead>
              <tbody>{report.rows.map((row, index) => <tr key={`${row.tarih}-${index}`} className="border-t border-border"><td className="px-3 py-2">{row.tarih.slice(0, 10)}</td><td>{row.islem}</td><td>{row.hesap}</td><td>{row.kategori}</td><td className="text-right">{row.gelir === "0.00" ? "-" : formatMoneyTR(row.gelir)}</td><td className="text-right">{row.gider === "0.00" ? "-" : formatMoneyTR(row.gider)}</td><td>{row.aciklama}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
