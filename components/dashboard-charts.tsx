"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoneyTR } from "@/lib/faz3";

type RevenuePoint = { label: string; tarih: string; tutar: number };
type OccupancyPoint = { label: string; doluluk: number };
type CariPoint = { cari: string; tutar: number };

type Props = {
  weeklyRevenue: RevenuePoint[];
  occupancyTrend: OccupancyPoint[];
  topCariRevenue: CariPoint[];
};

const moneyTooltip = (value: unknown) => formatMoneyTR(String(Number(value) || 0));

export function DashboardCharts({ weeklyRevenue, occupancyTrend, topCariRevenue }: Props) {
  const hasRevenue = weeklyRevenue.some((item) => item.tutar > 0);
  const hasCari = topCariRevenue.some((item) => item.tutar > 0);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-base font-semibold">Haftalık Gelir</h2>
        <div className="mt-3 h-[280px]">
          {hasRevenue ? (
            <ResponsiveContainer height="100%" width="100%">
              <AreaChart data={weeklyRevenue}>
                <CartesianGrid stroke="#d9e1e7" strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(value) => `${Number(value).toLocaleString("tr-TR")} ₺`} width={80} />
                <Tooltip formatter={moneyTooltip} labelFormatter={(label) => `Gün: ${label}`} />
                <Area dataKey="tutar" fill="#fff4df" stroke="#d9911f" strokeWidth={2} type="monotone" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border text-sm text-muted">
              Bu dönemde tahsilat kaydı yok.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-base font-semibold">Aylık Doluluk Trendi</h2>
        <div className="mt-3 h-[280px]">
          <ResponsiveContainer height="100%" width="100%">
            <LineChart data={occupancyTrend}>
              <CartesianGrid stroke="#d9e1e7" strokeDasharray="3 3" />
              <XAxis dataKey="label" interval={4} />
              <YAxis domain={[0, 100]} tickFormatter={(value) => `%${value}`} width={48} />
              <Tooltip formatter={(value) => `%${value}`} />
              <ReferenceLine stroke="#b42318" strokeDasharray="4 4" y={80} />
              <Line dataKey="doluluk" dot={false} stroke="#0b2d35" strokeWidth={2} type="monotone" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-md border border-border bg-surface p-4 xl:col-span-2">
        <h2 className="text-base font-semibold">Cari Bazlı Gelir</h2>
        <div className="mt-3 h-[280px]">
          {hasCari ? (
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={topCariRevenue} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid stroke="#d9e1e7" strokeDasharray="3 3" />
                <XAxis tickFormatter={(value) => `${Number(value).toLocaleString("tr-TR")} ₺`} type="number" />
                <YAxis dataKey="cari" type="category" width={160} />
                <Tooltip formatter={moneyTooltip} />
                <Bar dataKey="tutar" fill="#16744c" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border text-sm text-muted">
              Bu dönemde tahsilat kaydı yok.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
