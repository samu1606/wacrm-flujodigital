import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "samuel160612@gmail.com",
    pass: process.env.GMAIL_APP_PASSWORD || "",
  },
});

function buildEmail(lead: { email: string; name?: string; plan: string }) {
  const planNames: Record<string, string> = {
    emprendedor: "Emprendedor (Gratis)",
    pro: "PRO 🔥 ($29/mes — 50% OFF de por vida)",
    business: "Business Escala ($69/mes)",
  };
  const planName = planNames[lead.plan] || planNames.pro;
  const hasDiscount = lead.plan === "pro" || !lead.plan;
  const date = new Date().toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const name = lead.name && lead.name !== "Futuro cliente" ? ` ${lead.name}` : "";

  return {
    from: '"WASAPEA PRO" <samuel160612@gmail.com>',
    to: lead.email,
    subject: hasDiscount
      ? "🎉 ¡Bienvenido a WASAPEA PRO! Tu 50% OFF está reservado"
      : "¡Bienvenido a WASAPEA PRO!",
    text: `¡Hola${name}!

${hasDiscount ? "🔥 ¡FELICIDADES! Tienes 50% OFF DE POR VIDA en Plan PRO. Tu descuento está reservado.\n\n" : "Gracias por tu interés en WASAPEA PRO.\n\n"}Detalles de tu registro:

📅 Fecha: ${date}
📦 Plan: ${planName}

⏳ ¿Qué sigue?

Estamos ultimando el lanzamiento de WASAPEA PRO. Pronto recibirás:
✅ Tu link de acceso al dashboard
✅ Instrucciones para conectar tu WhatsApp en 30s con QR
✅ Demo personalizada por videollamada (opcional, sin costo)

¿Preguntas? Responde a este correo o escríbenos:
📱 WhatsApp: +57 317 366 2752

---
WASAPEA PRO — Wasapea. Vende. Crece.
Equipo WASAPEA | Colombia, LATAM 🇨🇴`,
  };
}

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
          {
            error: "duplicate",
            message: "Este email ya está registrado. ¡Ya tienes tu descuento reservado!",
          },
          { status: 409 }
        );
      }
      console.error("Supabase insert error:", dbError);
      return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
    }

    // 2. Enviar email de bienvenida (no bloqueante)
    const mailOptions = buildEmail({ email, name, plan });
    transporter.sendMail(mailOptions).catch((mailErr) => {
      console.warn("Email no enviado:", mailErr.message);
    });

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
