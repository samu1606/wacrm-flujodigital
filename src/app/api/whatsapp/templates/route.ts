/**
 * GET /api/whatsapp/templates — list the caller's message templates.
 *
 * Used by Quick Broadcast and any other UI component that needs a
 * lightweight list of {name, body_text} for template-picker dropdowns.
 * Server-side auth ensures RLS / session issues don't hide rows.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const accountId = profile?.account_id as string | undefined;
    if (!accountId) {
      return NextResponse.json(
        { error: "Profile not linked to an account." },
        { status: 403 },
      );
    }

    // Fetch templates scoped to this account. Include any status so
    // locally-saved templates ('local', 'DRAFT') are visible alongside
    // Meta-approved ones.
    const { data, error } = await supabase
      .from("message_templates")
      .select("name, body_text, category, language, status")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("GET /api/whatsapp/templates error:", error);
      return NextResponse.json(
        { error: "Failed to fetch templates." },
        { status: 500 },
      );
    }

    return NextResponse.json({ templates: data ?? [] });
  } catch (err) {
    console.error("GET /api/whatsapp/templates unexpected:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
