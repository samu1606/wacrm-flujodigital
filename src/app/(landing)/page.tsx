import Link from "next/link";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WASAPEA PRO — CRM SaaS de Ventas por WhatsApp",
  description:
    "Bandeja multiagente, pipelines Kanban, difusiones masivas y automatizaciones. CRM profesional para equipos que venden por WhatsApp.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "WASAPEA PRO — CRM SaaS de Ventas por WhatsApp",
    description:
      "Bandeja multiagente, pipelines Kanban, difusiones masivas y automatizaciones.",
    url: "https://wasapeapro.com",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050508] text-slate-100 font-sans overflow-x-hidden">
      {/* ===== Top Banner ===== */}
      <div className="border-b border-purple-900/20 bg-gradient-to-r from-purple-950/30 via-transparent to-purple-950/30 text-center text-sm py-2.5 px-4">
        <span className="text-purple-300/70">
          ⚡️ ¿Buscas alertas en tiempo real de Crypto, TRM, SECOP o Caídas Web?{" "}
        </span>
        <Link href="/alertas" className="text-purple-400 font-semibold hover:text-purple-300 transition-colors">
          Ir al Marketplace de Alertas →
        </Link>
      </div>

      {/* ===== Navbar ===== */}
      <nav className="sticky top-0 z-50 border-b border-slate-800/50 bg-[#050508]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-14">
          <Link href="/" className="font-extrabold text-lg tracking-tight">
            WASAPEA<span className="text-purple-500">PRO</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-slate-400">
            <a href="#funciones" className="hover:text-white transition-colors">Funciones</a>
            <Link href="/alertas" className="hover:text-white transition-colors">Alertas</Link>
            <a href="#precios" className="hover:text-white transition-colors">Precios</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors">
              Iniciar sesión
            </Link>
            <Link href="/join" className="text-sm px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors">
              Empezar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* ===== Hero ===== */}
      <section className="relative pt-20 pb-16 sm:pt-28 sm:pb-24 overflow-hidden">
        {/* Glow effects */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-emerald-500/8 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Text column */}
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/20 bg-purple-500/5 text-purple-300 text-xs font-medium mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                CRM SaaS para equipos de ventas
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] mb-6">
                WhatsApp{" "}
                <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-purple-400 bg-clip-text text-transparent">
                  profesional
                </span>
                <br />
                sin complicaciones
              </h1>

              <p className="text-slate-400 text-lg leading-relaxed mb-8 max-w-lg">
                Bandeja multiagente, pipelines Kanban, difusiones masivas y automatizaciones.
                Todo integrado con WhatsApp para que tu equipo venda más rápido.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/join" className="inline-flex justify-center px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all shadow-lg shadow-emerald-600/20">
                  Comenzar ahora — gratis
                </Link>
                <a href="#funciones" className="inline-flex justify-center px-6 py-3 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-300 font-medium transition-all">
                  Ver funciones
                </a>
              </div>

              <div className="flex items-center gap-6 mt-8 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">⭐ 4.9/5</span>
                <span className="flex items-center gap-1.5">🔒 Datos encriptados</span>
                <span className="flex items-center gap-1.5">⚡ Setup en 2 min</span>
              </div>
            </div>

            {/* UI Mockup column */}
            <MockupWindow />
          </div>
        </div>
      </section>

      {/* ===== Features ===== */}
      <section id="funciones" className="py-20 border-t border-slate-800/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Todo lo que necesitas para vender por WhatsApp</h2>
            <p className="text-slate-400 text-lg">Sin instalar apps extrañas. Sin bans. Sin dolores de cabeza.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="group p-6 rounded-2xl border border-slate-800/50 bg-slate-900/30 hover:bg-slate-900/50 hover:border-slate-700/50 transition-all">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-emerald-500/10 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-20 border-t border-slate-800/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="relative rounded-3xl border border-purple-500/15 bg-gradient-to-br from-purple-950/20 to-emerald-950/10 p-10 sm:p-16 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-40 bg-purple-500/8 rounded-full blur-3xl" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Empieza a vender por WhatsApp como un profesional</h2>
              <p className="text-slate-400 text-lg mb-8 max-w-lg mx-auto">
                Únete a los equipos que ya usan WASAPEA PRO para gestionar sus ventas.
              </p>
              <Link href="/join" className="inline-flex px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-lg transition-all shadow-lg shadow-emerald-600/20">
                Probar gratis →
              </Link>
              <p className="text-slate-600 text-xs mt-4">Sin tarjeta de crédito · Acceso completo · 7 días</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-slate-800/30 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <Link href="/" className="font-bold text-slate-300">
            WASAPEA<span className="text-purple-500">PRO</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/alertas" className="hover:text-slate-300 transition-colors">Alertas</Link>
            <Link href="/login" className="hover:text-slate-300 transition-colors">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Professional CRM UI mockup built entirely in Tailwind CSS */
function MockupWindow() {
  return (
    <div className="relative select-none">
      {/* Glow behind mockup */}
      <div className="absolute -inset-4 bg-gradient-to-br from-purple-500/15 via-emerald-500/5 to-transparent rounded-3xl blur-xl" />

      <div className="relative bg-slate-900/80 border border-slate-700/60 rounded-2xl shadow-2xl shadow-black/40 backdrop-blur-xl overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <div className="flex-1 text-center text-[11px] text-slate-500 font-medium tracking-wide">
            Wasapea Pro — Bandeja de Entrada
          </div>
        </div>

        {/* Split panel */}
        <div className="flex h-[340px] sm:h-[380px]">
          {/* Left: Contact list */}
          <div className="w-[36%] border-r border-slate-800 flex flex-col">
            <div className="px-3 py-2.5 border-b border-slate-800">
              <div className="bg-slate-800/60 rounded-md px-2.5 py-1.5 text-[11px] text-slate-500">
                🔍 Buscar conversación...
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {[
                { name: "María López", msg: "Me interesa el plan Pro...", time: "10:32", unread: 2, active: true },
                { name: "Carlos Ruiz", msg: "Gracias por la info 👍", time: "Ayer", unread: 0, active: false },
                { name: "Ana Martínez", msg: "¿Tienen descuento por...", time: "Ayer", unread: 1, active: false },
              ].map(c => (
                <div key={c.name} className={`px-3 py-2.5 border-b border-slate-800/50 flex items-start gap-2.5 ${c.active ? "bg-purple-500/8 border-l-2 border-l-emerald-400" : "hover:bg-slate-800/30"}`}>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-emerald-500 flex-shrink-0 flex items-center justify-center text-xs font-bold">
                    {c.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold truncate">{c.name}</span>
                      <span className="text-[10px] text-slate-600 flex-shrink-0 ml-1">{c.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{c.msg}</p>
                  </div>
                  {c.unread > 0 && (
                    <span className="flex-shrink-0 w-4 h-4 rounded-full bg-emerald-500 text-[10px] font-bold flex items-center justify-center text-white mt-1">
                      {c.unread}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Conversation */}
          <div className="flex-1 flex flex-col bg-slate-950/50">
            {/* Chat header */}
            <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-emerald-500 flex items-center justify-center text-[10px] font-bold">
                M
              </div>
              <div>
                <div className="text-xs font-semibold">María López</div>
                <div className="text-[10px] text-emerald-400">En línea</div>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  En curso
                </span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 space-y-4 overflow-hidden">
              {/* Agent message */}
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-purple-600 flex-shrink-0 flex items-center justify-center text-[10px]">W</div>
                <div>
                  <div className="bg-purple-500/10 border border-purple-500/15 rounded-2xl rounded-tl-sm px-3 py-2 text-[11px] text-slate-300 max-w-[200px]">
                    ¡Hola María! 👋 Gracias por tu interés. ¿En qué puedo ayudarte?
                  </div>
                  <span className="text-[9px] text-slate-600 mt-0.5 ml-1">10:30</span>
                </div>
              </div>

              {/* Client message */}
              <div className="flex items-start gap-2 justify-end">
                <div>
                  <div className="bg-emerald-500/10 border border-emerald-500/15 rounded-2xl rounded-tr-sm px-3 py-2 text-[11px] text-slate-300 max-w-[200px]">
                    Hola, me interesa el plan Pro. ¿Tienen disponibilidad para 5 agentes?
                  </div>
                  <span className="text-[9px] text-slate-600 mt-0.5 mr-1 block text-right">10:31</span>
                </div>
              </div>

              {/* Agent final */}
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-purple-600 flex-shrink-0 flex items-center justify-center text-[10px]">W</div>
                <div>
                  <div className="bg-purple-500/10 border border-purple-500/15 rounded-2xl rounded-tl-sm px-3 py-2 text-[11px] text-slate-300 max-w-[200px]">
                    ¡Claro que sí! El plan Pro incluye hasta 5 agentes con pipelines ilimitados. ¿Te paso el enlace de pago?
                  </div>
                  <span className="text-[9px] text-slate-600 mt-0.5 ml-1">10:32</span>
                </div>
              </div>
            </div>

            {/* Chat input */}
            <div className="px-4 py-3 border-t border-slate-800 flex items-center gap-2">
              <div className="flex-1 bg-slate-800/60 rounded-full px-3 py-1.5 text-[11px] text-slate-500 flex items-center gap-2">
                <span className="text-base">😊</span>
                Escribe un mensaje...
              </div>
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm">
                ▶
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: "📥", title: "Bandeja multiagente", desc: "Múltiples agentes atendiendo el mismo número simultáneamente. Asigna, etiqueta y da seguimiento." },
  { icon: "📊", title: "Kanban & Pipelines", desc: "Visualiza tus ventas en columnas. Arrastra tarjetas entre estados. Pipeline personalizable por equipo." },
  { icon: "📢", title: "Difusiones masivas", desc: "Envía mensajes a cientos de contactos con la API oficial de WhatsApp. Sin bans, sin bloqueos." },
  { icon: "⚡", title: "Automatizaciones", desc: "Dispara mensajes automáticos por eventos, horarios o acciones del cliente. Sin código." },
  { icon: "📇", title: "CRM integrado", desc: "Contactos, notas, historial completo y tags. Todo vinculado a cada conversación." },
  { icon: "📡", title: "Alertas en tiempo real", desc: "Activa alertas de Crypto, TRM, SECOP y más. Recibe notificaciones directo en WhatsApp." },
];
