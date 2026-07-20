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
import { Radio, Send, X, Users, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';

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

  // Load contacts
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const supabase = createClient();
    Promise.all([
      supabase.from('contacts').select('id, phone, name').order('created_at', { ascending: false }).limit(500),
      supabase.from('tags').select('id, name').order('name'),
    ]).then(([{ data: contactData, error: cErr }, { data: tagData }]) => {
      if (cErr) {
        toast.error('Error al cargar contactos');
        return;
      }
      setContacts(contactData || []);
      setTags(tagData || []);
      // Auto-select all by default
      if (contactData) {
        setSelectedContactIds(new Set(contactData.map((c) => c.id)));
      }
      setLoading(false);
    });
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
            <label className="text-sm font-medium mb-1 block">Mensaje</label>
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
