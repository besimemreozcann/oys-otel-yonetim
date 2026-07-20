"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function DolulukReportChart({ rows }: { rows: Array<{ tarih: string; doluluk: number }> }) {
  return (
    <div className="h-[260px] rounded-md border border-border bg-surface p-4">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={rows}>
          <CartesianGrid stroke="#d9e1e7" strokeDasharray="3 3" />
          <XAxis dataKey="tarih" interval={Math.max(Math.floor(rows.length / 8), 0)} />
          <YAxis domain={[0, 100]} tickFormatter={(value) => `%${value}`} />
          <Tooltip formatter={(value) => `%${value}`} />
          <Bar dataKey="doluluk" fill="#d9911f" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GelirGiderReportChart({ rows }: { rows: Array<{ tarih: string; gelir: number; gider: number }> }) {
  return (
    <div className="h-[260px] rounded-md border border-border bg-surface p-4">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={rows}>
          <CartesianGrid stroke="#d9e1e7" strokeDasharray="3 3" />
          <XAxis dataKey="tarih" />
          <YAxis tickFormatter={(value) => `${Number(value).toLocaleString("tr-TR")} ₺`} width={80} />
          <Tooltip formatter={(value) => `${Number(value).toLocaleString("tr-TR")} ₺`} />
          <Bar dataKey="gelir" fill="#16744c" radius={[4, 4, 0, 0]} />
          <Bar dataKey="gider" fill="#b42318" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
