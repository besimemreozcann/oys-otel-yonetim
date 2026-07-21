import ExcelJS from "exceljs";
import { jsonError, parseJsonBody } from "@/lib/api";
import { getReportPayload } from "@/lib/reports";
import { reportFileName, reportRequestSchema, reportSheetName, reportToTable, requireReportExportPermission, sanitizeExcelRow } from "@/lib/report-export";

export async function POST(request: Request) {
  const body = await parseJsonBody(request);
  if (body.error) return body.error;

  const parsed = reportRequestSchema.safeParse(body.data);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Rapor filtrelerini kontrol edin.", 400);

  const permissionError = await requireReportExportPermission(parsed.data);
  if (permissionError) return permissionError;

  const payload = await getReportPayload(parsed.data.raporTuru, parsed.data);
  const table = reportToTable(parsed.data.raporTuru, payload);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OYS";
  const worksheet = workbook.addWorksheet(reportSheetName(parsed.data.raporTuru));
  worksheet.addRow(sanitizeExcelRow([table.title]));
  worksheet.addRow([]);
  worksheet.addRow(sanitizeExcelRow(table.headers));
  for (const row of table.rows) worksheet.addRow(sanitizeExcelRow(row));
  if (table.summary?.length) {
    worksheet.addRow([]);
    worksheet.addRow(sanitizeExcelRow(table.summary));
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
