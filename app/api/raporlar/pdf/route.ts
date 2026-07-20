import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { jsonError } from "@/lib/api";
import { getReportPayload } from "@/lib/reports";
import { reportFileName, reportRequestSchema, reportToTable, requireReportExportPermission } from "@/lib/report-export";

export async function POST(request: Request) {
  const parsed = reportRequestSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Rapor filtrelerini kontrol edin.", 400);

  const permissionError = await requireReportExportPermission(parsed.data);
  if (permissionError) return permissionError;

  const payload = await getReportPayload(parsed.data.raporTuru, parsed.data);
  const table = reportToTable(parsed.data.raporTuru, payload);
  const doc = new jsPDF({ orientation: table.headers.length > 6 ? "landscape" : "portrait" });
  doc.setFontSize(14);
  doc.text(table.title, 14, 16);
  autoTable(doc, {
    startY: 24,
    head: [table.headers],
    body: table.rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [35, 78, 112] }
  });
  if (table.summary?.length) {
    const finalY = (doc as any).lastAutoTable?.finalY ?? 24;
    doc.setFontSize(10);
    doc.text(table.summary.join("   "), 14, finalY + 12);
  }

  const bytes = Buffer.from(doc.output("arraybuffer"));
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${reportFileName(parsed.data.raporTuru, "pdf")}"`
    }
  });
}
