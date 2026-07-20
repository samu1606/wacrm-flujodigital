import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const n8nWebhookUrl = process.env.N8N_WEBHOOK_WELCOME_URL || "http://148.230.90.171:5678/webhook/wasapea-welcome";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name, plan } = body;

    if (!email) {
      return NextResponse.json({ error: "Email es requerido" }, { status: 400 });
    }

    // 1. Insertar en Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error: dbError } = await supabase
      .from("leads")
      .insert({
        email: email.trim().toLowerCase(),
        name: name?.trim() || null,
        plan: plan || "pro",
        source: "wasapea_landing",
      })
      .select()
      .single();

    if (dbError) {
      if (dbError.code === "23505") {
        return NextResponse.json(
          { error: "duplicate", message: "Este email ya está registrado. ¡Ya tienes tu descuento reservado!" },
          { status: 409 }
        );
      }
      console.error("Supabase insert error:", dbError);
      return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
    }

    // 2. Disparar email de bienvenida via n8n (no bloqueante)
    try {
      await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, plan }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (webhookErr) {
      console.warn("n8n webhook falló (email no enviado):", webhookErr);
      // No fallamos — el lead ya está guardado
    }

    return NextResponse.json({
      success: true,
      message: "¡Bienvenido! Revisa tu correo para confirmar.",
      lead: data,
    });
  } catch (err) {
    console.error("Waitlist API error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
