import { existsSync, readFileSync } from "fs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { jsonError, parseJsonBody } from "@/lib/api";
import { getReportPayload } from "@/lib/reports";
import { reportFileName, reportRequestSchema, reportToTable, requireReportExportPermission } from "@/lib/report-export";

export const runtime = "nodejs";

const PDF_FONT_NAME = "OYSUnicode";
const PDF_FONT_FILE = "OYSUnicode-Regular.ttf";
const FONT_PATHS = [
  "C:/Windows/Fonts/Roboto-Regular.ttf",
  "C:/Windows/Fonts/arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"
];

let cachedFontBase64: string | null = null;

function loadUnicodeFontBase64() {
  if (cachedFontBase64) return cachedFontBase64;

  const fontPath = FONT_PATHS.find((candidate) => existsSync(candidate));
  if (!fontPath) return null;

  cachedFontBase64 = readFileSync(fontPath).toString("base64");
  return cachedFontBase64;
}

function configurePdfFont(doc: jsPDF) {
  const fontBase64 = loadUnicodeFontBase64();
  if (!fontBase64) return "helvetica";

  doc.addFileToVFS(PDF_FONT_FILE, fontBase64);
  doc.addFont(PDF_FONT_FILE, PDF_FONT_NAME, "normal");
  doc.setFont(PDF_FONT_NAME);
  return PDF_FONT_NAME;
}

export async function POST(request: Request) {
  const body = await parseJsonBody(request);
  if (body.error) return body.error;

  const parsed = reportRequestSchema.safeParse(body.data);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Rapor filtrelerini kontrol edin.", 400);

  const permissionError = await requireReportExportPermission(parsed.data);
  if (permissionError) return permissionError;

  const payload = await getReportPayload(parsed.data.raporTuru, parsed.data);
  const table = reportToTable(parsed.data.raporTuru, payload);
  const doc = new jsPDF({ orientation: table.headers.length > 6 ? "landscape" : "portrait" });
  const pdfFont = configurePdfFont(doc);
  doc.setFontSize(14);
  doc.text(table.title, 14, 16);
  autoTable(doc, {
    startY: 24,
    head: [table.headers],
    body: table.rows,
    styles: { font: pdfFont, fontSize: 8 },
    headStyles: { fillColor: [35, 78, 112], font: pdfFont }
  });
  if (table.summary?.length) {
    const finalY = (doc as any).lastAutoTable?.finalY ?? 24;
    doc.setFont(pdfFont);
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
