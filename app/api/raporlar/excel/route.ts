import ExcelJS from "exceljs";
import { jsonError } from "@/lib/api";
import { getReportPayload } from "@/lib/reports";
import { reportFileName, reportRequestSchema, reportSheetName, reportToTable, requireReportExportPermission } from "@/lib/report-export";

export async function POST(request: Request) {
  const parsed = reportRequestSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Rapor filtrelerini kontrol edin.", 400);

  const permissionError = await requireReportExportPermission(parsed.data);
  if (permissionError) return permissionError;

  const payload = await getReportPayload(parsed.data.raporTuru, parsed.data);
  const table = reportToTable(parsed.data.raporTuru, payload);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OYS";
  const worksheet = workbook.addWorksheet(reportSheetName(parsed.data.raporTuru));
  worksheet.addRow([table.title]);
  worksheet.addRow([]);
  worksheet.addRow(table.headers);
  for (const row of table.rows) worksheet.addRow(row);
  if (table.summary?.length) {
    worksheet.addRow([]);
    worksheet.addRow(table.summary);
  }
  worksheet.getRow(1).font = { bold: true, size: 14 };
  worksheet.getRow(3).font = { bold: true };
  worksheet.columns.forEach((column) => {
    let maxLength = 12;
    for (const value of column.values ?? []) {
      maxLength = Math.max(maxLength, String(value ?? "").length);
    }
    column.width = Math.min(32, maxLength);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${reportFileName(parsed.data.raporTuru, "xlsx")}"`
    }
  });
}
