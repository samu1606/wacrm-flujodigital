'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, ArrowRight, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  CreateTemplateDialog,
} from '@/components/templates/create-template-dialog';

const categoryColors: Record<string, string> = {
  Marketing: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Utility: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Authentication: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

interface Step1Props {
  selectedTemplate: MessageTemplate | null;
  onSelect: (template: MessageTemplate) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step1ChooseTemplate({ selectedTemplate, onSelect, onNext, onBack }: Step1Props) {
  const t = useTranslations('Broadcasts.wizard');
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      // Only APPROVED templates can be sent via Meta — anything else
      // would 400 at broadcast time. Hide them rather than letting
      // the user pick a template that will fail.
      const { data, error: fetchError } = await supabase
        .from('message_templates')
        .select('*')
        .in('status', ['APPROVED', 'local', 'PENDING', 'DRAFT'])
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setTemplates(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('chooseTemplate.errorLoad'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('chooseTemplate.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('chooseTemplate.subtitle')}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="shrink-0 gap-1.5 border-primary/30 text-primary hover:bg-primary/10 h-8 text-xs"
        >
          <Plus className="size-3.5" />
          {t('chooseTemplate.createNew')}
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-border bg-card/50">
          <FileText className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('chooseTemplate.noTemplates')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('chooseTemplate.createFirst')}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="mt-3 gap-1.5 border-primary/30 text-primary hover:bg-primary/10 h-8 text-xs"
          >
            <Plus className="size-3.5" />
            {t('chooseTemplate.createNew')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const isSelected = selectedTemplate?.id === template.id;
            const catColor = categoryColors[template.category] ?? categoryColors.Utility;

            return (
              <button
                key={template.id}
                onClick={() => onSelect(template)}
                className={`flex flex-col gap-3 rounded-xl border p-4 text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                    : 'border-border bg-card/50 hover:border-border hover:bg-card'
                }`}
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-medium text-foreground">{template.name}</h3>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${catColor}`}
                  >
                    {template.category}
                  </span>
                </div>
                <p className="line-clamp-3 text-xs text-muted-foreground">{template.body_text}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{template.language ?? 'en_US'}</span>
                  {template.status !== 'APPROVED' && (
                    <span
                      className={
                        template.status === 'local'
                          ? 'text-green-400'
                          : template.status === 'DRAFT'
                            ? 'text-yellow-400'
                            : 'text-blue-400'
                      }
                    >
                      · {template.status === 'local' ? 'local' : template.status}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button variant="outline" onClick={onBack} className="border-border text-muted-foreground">
          {t('back')}
        </Button>
        <Button
          onClick={onNext}
          disabled={!selectedTemplate}
          className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {t('next')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick-create template dialog — lets the user create a new
          template without leaving the broadcast wizard. On success,
          refetch the template list so it's immediately selectable. */}
      <CreateTemplateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => {
          fetchTemplates();
        }}
      />
    </div>
  );
}
