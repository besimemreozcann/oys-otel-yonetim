import { NextResponse } from "next/server";
import { intParam, jsonError, requireApiHotelPermission } from "@/lib/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let otelId: number;
  try {
    otelId = intParam(searchParams.get("otelId"), "Otel");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Otel geçerli değil.", 400);
  }

  const permission = await requireApiHotelPermission(otelId, "finans", "GORUNTULE");
  if (permission.error) return permission.error;

  return NextResponse.json({
    otelId,
    message: "Finans endpoint erişimi doğrulandı. Finans ekranları Faz 4 kapsamındadır."
  });
}
