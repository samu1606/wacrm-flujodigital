'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Radio, Send, X, Users, Loader2, MessageSquare, ChevronDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  SelectLabel,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';

// ================================================================
// Plantillas predeterminadas para difusiones rápidas
// ================================================================
const DEFAULT_TEMPLATES: { label: string; value: string; message: string }[] = [
  {
    label: '🎉 Oferta / Promoción',
    value: 'promo',
    message: '¡Hola {{name}}! 🚀\n\nTenemos una oferta especial para ti: **20% de descuento** en todos nuestros servicios durante este mes.\n\n¿Te interesa? Escríbeme y te doy más detalles.\n\n¡No te lo pierdas!',
  },
  {
    label: '📋 Recordatorio de cita',
    value: 'reminder',
    message: 'Hola {{name}}, te recuerdo que tienes una cita agendada para **mañana a las 10:00 AM**.\n\nPor favor confírmame si puedes asistir. ¡Gracias!',
  },
  {
    label: '👋 Bienvenida nuevo cliente',
    value: 'welcome',
    message: '¡Hola {{name}}! 👋\n\nBienvenido/a a nuestra comunidad. Soy Edwin de WASAPEA PRO y estoy aquí para ayudarte.\n\nCualquier duda que tengas, solo responde este mensaje.\n\n¡Gracias por confiar en nosotros! 💚',
  },
  {
    label: '📞 Seguimiento post-venta',
    value: 'followup',
    message: 'Hola {{name}}, ¿cómo vas con el servicio? Quería saber si todo está funcionando bien o si necesitas algo.\n\nEstoy aquí para ayudarte. ¡Gracias! 😊',
  },
  {
    label: '📢 Anuncio importante',
    value: 'announcement',
    message: 'Hola {{name}},\n\nQueremos informarte que tenemos **nuevos horarios de atención**:\n\n📅 Lunes a Viernes: 8 AM - 6 PM\n📅 Sábados: 9 AM - 1 PM\n\n¡Gracias por tu atención!',
  },
  {
    label: '💰 Recordatorio de pago',
    value: 'payment',
    message: 'Hola {{name}},\n\nTe recordamos que el pago de tu servicio vence el **próximo viernes**. Por favor realiza el pago para evitar interrupción.\n\nSi ya lo hiciste, ignora este mensaje. ¡Gracias!',
  },
  {
    label: '⭐ Pedir reseña',
    value: 'review',
    message: '¡Hola {{name}}! ⭐\n\nSi estás contento/a con nuestro servicio, nos ayudaría muchísimo que nos dejaras una reseña en Google.\n\nToma solo 1 minuto: [link-a-tu-google-maps]\n\n¡Mil gracias! 🙏',
  },
];

interface ContactTag {
  id: string;
  name: string;
}

interface QuickBroadcastProps {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}

export function QuickBroadcast({ open, onClose, onSent }: QuickBroadcastProps) {
  const [message, setMessage] = useState('');
  const [contacts, setContacts] = useState<{ id: string; phone: string; name: string }[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(true);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tags, setTags] = useState<ContactTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [userTemplates, setUserTemplates] = useState<
    { label: string; value: string; message: string }[]
  >([]);

  // Load contacts, tags, and user templates when dialog opens.
  // Templates are fetched via the server-side API (to bypass RLS) in
  // a SEPARATE promise from contacts/tags — a template fetch failure
  // must never block contact loading or crash the dialog.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const supabase = createClient();

    // Contacts + tags — these are critical; if they fail, we show the
    // error and bail out (the dialog is useless without recipients).
    Promise.all([
      supabase.from('contacts').select('id, phone, name').order('created_at', { ascending: false }).limit(500),
      supabase.from('tags').select('id, name').order('name'),
    ])
      .then(([{ data: contactData, error: contactErr }, { data: tagData }]) => {
        if (contactErr) {
          toast.error('Error al cargar contactos');
          return;
        }
        setContacts(contactData || []);
        setTags(tagData || []);
        if (contactData) {
          setSelectedContactIds(new Set(contactData.map((c) => c.id)));
        }
      })
      .finally(() => setLoading(false));

    // Templates — fire-and-forget alongside contacts. Failure here is
    // non-fatal: the dropdown simply falls back to the 7 predefined
    // templates without any error toast.
    (async () => {
      try {
        const res = await fetch('/api/whatsapp/templates');
        if (!res.ok) {
          console.warn(
            '[quick-broadcast] template API returned',
            res.status,
          );
          return;
        }
        const body: unknown = await res.json();
        if (
          !body ||
          typeof body !== 'object' ||
          !('templates' in body)
        ) {
          console.warn(
            '[quick-broadcast] unexpected template API shape',
            body,
          );
          return;
        }
        const raw = (body as { templates: unknown }).templates;
        if (!Array.isArray(raw) || raw.length === 0) return;

        const mapped = (raw as { name: string; body_text: string }[]).map(
          (t, i) => ({
            label: `📝 ${t.name ?? 'plantilla'}`,
            value: `user-${i}`,
            message: t.body_text ?? '',
          }),
        );
        setUserTemplates(mapped);
      } catch (err) {
        // Network / parse error — non-fatal, just log and fall back
        // to the hardcoded defaults.
        console.warn('[quick-broadcast] template fetch error:', err);
      }
    })();
  }, [open]);

  // Filter contacts by selected tags
  const filteredContacts = contacts; // simplified for now

  const toggleContact = (id: string) => {
    setSelectAll(false);
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectAll(false);
      setSelectedContactIds(new Set());
    } else {
      setSelectAll(true);
      setSelectedContactIds(new Set(contacts.map((c) => c.id)));
    }
  };

  async function handleSend() {
    if (!message.trim()) {
      toast.error('Escribe un mensaje');
      return;
    }

    const ids = selectAll
      ? contacts.map((c) => c.id)
      : Array.from(selectedContactIds);

    if (ids.length === 0) {
      toast.error('Selecciona al menos un contacto');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/v1/broadcasts/evo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Difusión rápida — ${new Date().toLocaleString('es-CO')}`,
          message,
          contactIds: ids,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Difusión iniciada: ${data.total} destinatarios. Se enviarán en ~${Math.ceil(data.total * 3 / 60)} minutos.`);
        onSent();
        onClose();
      } else {
        toast.error(data.error || 'Error al iniciar difusión');
        if (data.detail) console.error('[quick-broadcast]', data.detail);
      }
    } catch (err) {
      toast.error('Error de conexión');
    } finally {
      setSending(false);
    }
  }

  const selectedCount = selectAll ? contacts.length : selectedContactIds.size;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Radio className="size-5 text-primary" />
            Difusión Rápida
          </DialogTitle>
          <DialogDescription>
            Envía un mensaje de texto a tus contactos sin necesidad de plantillas.
            Los mensajes se envían uno por uno con pausas para evitar bloqueos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Message */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium">Mensaje</label>
              <Select
                onValueChange={(val) => {
                  const all = [...userTemplates, ...DEFAULT_TEMPLATES];
                  const tpl = all.find(t => t.value === val);
                  if (tpl) setMessage(tpl.message);
                }}
              >
                <SelectTrigger className="h-7 w-auto gap-1 text-xs border-primary/30 bg-primary/10 text-primary-foreground hover:bg-primary/20 min-w-[160px]">
                  <MessageSquare className="size-3" />
                  <SelectValue placeholder="Usar plantilla..." />
                </SelectTrigger>
                <SelectContent className="min-w-[280px]">
                  {userTemplates.length > 0 && (
                    <>
                      <SelectGroup>
                        <SelectLabel className="text-[10px] text-muted-foreground">
                          Tus plantillas
                        </SelectLabel>
                        {userTemplates.map(tpl => (
                          <SelectItem key={tpl.value} value={tpl.value} className="text-sm">
                            {tpl.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectSeparator />
                    </>
                  )}
                  <SelectGroup>
                    {userTemplates.length > 0 && (
                      <SelectLabel className="text-[10px] text-muted-foreground">
                        Plantillas predefinidas
                      </SelectLabel>
                    )}
                    {DEFAULT_TEMPLATES.map(tpl => (
                      <SelectItem key={tpl.value} value={tpl.value} className="text-sm">
                        {tpl.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe tu mensaje aquí... Usa {{name}} para personalizar con el nombre del contacto."
              rows={4}
              maxLength={4096}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {message.length}/4096 • {'{{name}}'} = nombre del contacto
            </p>
          </div>

          {/* Recipients summary */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <span className="text-sm">
                {loading ? (
                  <Loader2 className="size-3 animate-spin inline" />
                ) : (
                  <strong>{selectedCount}</strong>
                )}{' '}
                destinatarios
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSelectAll}
              className="text-xs"
            >
              {selectAll ? 'Seleccionar manualmente' : 'Seleccionar todos'}
            </Button>
          </div>

          {/* Contact list (only show if manual selection) */}
          {!selectAll && contacts.length > 0 && (
            <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
              {contacts.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/50 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedContactIds.has(c.id)}
                    onChange={() => toggleContact(c.id)}
                    className="rounded"
                  />
                  <span className="truncate">
                    {c.name || c.phone}
                    {c.name && (
                      <span className="text-muted-foreground ml-1">
                        ({c.phone})
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* Rate info */}
          <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-950/20 text-amber-200 text-xs">
            ⚡ Los mensajes se envían con 3 segundos de pausa (~20/min) para
            cumplir con los límites de WhatsApp y evitar bloqueos.{' '}
            {selectedCount > 10 && (
              <strong>
                ~{Math.ceil(selectedCount * 3 / 60)} min estimado para {selectedCount} contactos.
              </strong>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !message.trim() || selectedCount === 0}
            className="gap-2"
          >
            {sending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Iniciando...
              </>
            ) : (
              <>
                <Send className="size-4" />
                Enviar a {selectedCount} contactos
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
