import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/supabaseAdmin"
import { TABLES } from "@/lib/supabase/tables"

/** Public: List all centers (for registration) */
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from(TABLES.centers)
    .select("id, name")
    .order("name")

  if (error) {
    return NextResponse.json(
      { error: { code: "FETCH_FAILED", message: error.message } },
      { status: 500 }
    )
  }
  return NextResponse.json(data || [])
}
