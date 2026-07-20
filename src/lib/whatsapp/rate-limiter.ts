/**
 * WhatsApp Rate Limiter — previene baneos de Meta/WhatsApp.
 *
 * Estrategia:
 *   - Sliding window por instancia Evolution
 *   - 20 mensajes/minuto (inbox normal)
 *   - 60 seg cooldown broadcast (cuando se implemente)
 *   - Hard cap: 50 msg/min (bloquea, no encola)
 *
 * Uso:
 *   const limiter = rateLimiter.check('instancia-id', 'message');
 *   if (!limiter.allowed) throw new Error(limiter.reason);
 */

interface WindowEntry {
  timestamps: number[];
}

interface CheckResult {
  allowed: boolean;
  remaining: number;
  /** Segundos hasta que libere (0 si allowed) */
  retryAfterSec: number;
  reason?: string;
}

const WINDOW_MS = 60_000; // 1 minuto

// Límites por instancia
const LIMITS: Record<string, number> = {
  message: 20,          // 20 mensajes/min (inbox normal)
  broadcast: 10,        // 10 mensajes/min (broadcasts — más restrictivo)
  hard: 50,            // 50 mensajes/min (hard cap absoluto)
};

// Instancia → tipo → timestamps
const store = new Map<string, Map<string, WindowEntry>>();

/** Limpiar ventanas viejas cada 5 min */
setInterval(() => {
  const now = Date.now();
  for (const [instance, types] of store) {
    for (const [type, entry] of types) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS);
    }
  }
}, 300_000);

function getOrCreateEntry(
  instance: string,
  type: string
): WindowEntry {
  if (!store.has(instance)) {
    store.set(instance, new Map());
  }
  const types = store.get(instance)!;
  if (!types.has(type)) {
    types.set(type, { timestamps: [] });
  }
  return types.get(type)!;
}

export function rateLimiterCheck(
  instanceName: string,
  type: 'message' | 'broadcast' = 'message'
): CheckResult {
  const now = Date.now();
  const limit = LIMITS[type] || LIMITS.hard;

  // Limpiar entradas vencidas
  const entry = getOrCreateEntry(instanceName, type);
  entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS);

  // Check hard cap
  const hardEntry = getOrCreateEntry(instanceName, 'hard');
  hardEntry.timestamps = hardEntry.timestamps.filter((t) => now - t < WINDOW_MS);
  if (hardEntry.timestamps.length >= LIMITS.hard) {
    const oldest = hardEntry.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((oldest + WINDOW_MS - now) / 1000),
      reason: `Límite máximo de ${LIMITS.hard} mensajes/minuto alcanzado. Espera ${Math.ceil((oldest + WINDOW_MS - now) / 1000)}s.`,
    };
  }

  // Check type-specific limit
  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((oldest + WINDOW_MS - now) / 1000),
      reason: `Límite de ${limit} mensajes/minuto alcanzado. Espera ${Math.ceil((oldest + WINDOW_MS - now) / 1000)}s.`,
    };
  }

  // Allowed — registrar
  entry.timestamps.push(now);
  hardEntry.timestamps.push(now);

  return {
    allowed: true,
    remaining: limit - entry.timestamps.length,
    retryAfterSec: 0,
  };
}

/** Obtener estado actual del rate limiter (sin consumir) */
export function rateLimiterStatus(
  instanceName: string,
  type: 'message' | 'broadcast' = 'message'
): { used: number; limit: number; remaining: number } {
  const now = Date.now();
  const entry = getOrCreateEntry(instanceName, type);
  entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS);
  const limit = LIMITS[type] || LIMITS.hard;

  return {
    used: entry.timestamps.length,
    limit,
    remaining: Math.max(0, limit - entry.timestamps.length),
  };
}
