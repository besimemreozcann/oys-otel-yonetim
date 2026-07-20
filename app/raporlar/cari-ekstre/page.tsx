import { AppShell } from "@/components/app-shell";
import { ExportButtons } from "@/components/raporlar/export-buttons";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { hasHotelPermission } from "@/lib/authz";
import { formatMoneyTR } from "@/lib/faz3";
import { buildCariEkstreReport, defaultEnd, defaultStart } from "@/lib/reports";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

type PageProps = {
  searchParams: Promise<{ otelId?: string; cariId?: string; baslangic?: string; bitis?: string }>;
};

export default async function CariEkstreRaporuPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const [allHotels, permissions, cariler] = await Promise.all([
    prisma.otel.findMany({ where: { silindiMi: false, aktifMi: true }, orderBy: { ad: "asc" } }),
    prisma.kullaniciOtelYetkisi.findMany({ where: { kullaniciId: session.id } }),
    prisma.cari.findMany({ where: { silindiMi: false, aktifMi: true }, orderBy: { ad: "asc" } })
  ]);
  const visibleHotels = session.rol === "SUPER_ADMIN" ? allHotels : allHotels.filter((hotel) => permissions.some((permission) => permission.otelId === hotel.id));
  const selectedHotel = visibleHotels.find((hotel) => hotel.id === Number(params.otelId)) ?? visibleHotels[0] ?? null;
  const selectedCari = cariler.find((cari) => cari.id === Number(params.cariId)) ?? cariler[0] ?? null;
  if (!selectedHotel) return <AppShell hotelSelectorAction="/raporlar/cari-ekstre"><section className="rounded-md border border-border bg-surface p-4">Yetkili otel bulunamadı.</section></AppShell>;
  const decision = hasHotelPermission(session, permissions, selectedHotel.id, "rapor", "GORUNTULE");
  if (!decision.allowed) return <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/raporlar/cari-ekstre"><section className="rounded-md border border-border bg-surface p-4">Rapor görüntüleme yetkiniz yok.</section></AppShell>;
  const baslangic = params.baslangic ?? defaultStart(30);
  const bitis = params.bitis ?? defaultEnd();
  const report = selectedCari ? await buildCariEkstreReport({ otelId: selectedHotel.id, cariId: selectedCari.id, baslangic, bitis }) : null;

  return (
    <AppShell selectedHotelId={selectedHotel.id} hotelSelectorAction="/raporlar/cari-ekstre">
      <div className="grid gap-6">
        <div><div className="text-sm text-muted">Raporlar &gt; Cari Ekstre</div><h1 className="mt-1 text-2xl font-semibold">Cari Ekstre Raporu</h1></div>
        <form action="/raporlar/cari-ekstre" className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface p-4">
          <label className="grid gap-1 text-sm">Otel<Select name="otelId" defaultValue={selectedHotel.id}>{visibleHotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.ad}</option>)}</Select></label>
          <label className="grid gap-1 text-sm">Cari<Select name="cariId" defaultValue={selectedCari?.id ?? ""}>{cariler.map((cari) => <option key={cari.id} value={cari.id}>{cari.ad}</option>)}</Select></label>
          <label className="grid gap-1 text-sm">Başlangıç<input className="h-9 rounded-md border border-border px-3 text-sm" name="baslangic" type="date" defaultValue={baslangic} /></label>
          <label className="grid gap-1 text-sm">Bitiş<input className="h-9 rounded-md border border-border px-3 text-sm" name="bitis" type="date" defaultValue={bitis} /></label>
          <Button type="submit">Filtrele</Button>
          <ExportButtons disabled={!selectedCari} filters={{ otelId: selectedHotel.id, cariId: selectedCari?.id, baslangic, bitis }} reportType="cari-ekstre" />
        </form>
        <section className="rounded-md border border-border bg-surface p-4">
          <h2 className="text-lg font-semibold">{report?.cariName ?? "Cari seçilmedi"}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#eef3f6] text-left text-xs uppercase text-muted"><tr><th className="px-3 py-2">Tarih</th><th>Otel/Oda</th><th>Kişi</th><th>İşlem</th><th className="text-right">Borç</th><th className="text-right">Alacak</th><th className="text-right">Bakiye</th></tr></thead>
              <tbody>{report?.rows.map((row, index) => <tr key={`${row.tarih}-${index}`} className="border-t border-border"><td className="px-3 py-2">{row.tarih.slice(0, 10)}</td><td>{row.otelOda}</td><td>{row.kisi ?? "-"}</td><td>{row.islem}</td><td className="text-right">{formatMoneyTR(row.borc)}</td><td className="text-right">{formatMoneyTR(row.alacak)}</td><td className="text-right font-medium">{formatMoneyTR(row.bakiye)}</td></tr>)}</tbody>
            </table>
          </div>
          {report ? <div className="mt-4 flex flex-wrap justify-end gap-4 text-sm font-semibold"><span>Toplam Borç: {formatMoneyTR(report.summary.toplamBorc)}</span><span>Toplam Alacak: {formatMoneyTR(report.summary.toplamAlacak)}</span><span>Bakiye: {formatMoneyTR(report.summary.bakiye)}</span></div> : null}
        </section>
      </div>
    </AppShell>
  );
}
