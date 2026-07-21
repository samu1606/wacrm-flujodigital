import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'
import { submitMessageTemplate } from '@/lib/whatsapp/meta-api'
import {
  validateTemplatePayload,
  type TemplatePayload,
} from '@/lib/whatsapp/template-validators'
import { buildMetaTemplatePayload } from '@/lib/whatsapp/template-components'
import { ensureImageHeaderHandle } from '@/lib/whatsapp/template-header-handle'
import { normalizeStatus } from '@/lib/whatsapp/template-status-normalize'

/**
 * Shared upsert payload builder — both the Meta-failure path and the
 * Meta-success path write nearly identical rows; dropping the shared
 * fields here means adding a column later only touches one spot.
 */
function buildUpsertRow(
  accountId: string,
  userId: string,
  payload: TemplatePayload,
  extras: {
    status: 'DRAFT' | string
    metaTemplateId: string | null
    submissionError: string | null
  },
) {
  return {
    // Account tenancy — required NOT NULL on message_templates as
    // of migration 017. Without this an INSERT throws on the
    // not-null constraint.
    account_id: accountId,
    // Original author — kept as audit only. The unique index is
    // still on (user_id, name, language) — see the upsert helper
    // for the cross-teammate dedup follow-up.
    user_id: userId,
    name: payload.name,
    category: payload.category,
    language: payload.language,
    header_type: payload.header_type ?? null,
    header_content: payload.header_content ?? null,
    header_media_url: payload.header_media_url ?? null,
    header_handle: payload.header_handle ?? null,
    body_text: payload.body_text,
    footer_text: payload.footer_text ?? null,
    buttons: payload.buttons ?? null,
    sample_values: payload.sample_values ?? null,
    status: extras.status,
    meta_template_id: extras.metaTemplateId,
    submission_error: extras.submissionError,
    // Clear stale rejection_reason whenever we re-submit; the
    // webhook will set it again if Meta still rejects.
    rejection_reason: extras.submissionError ? null : null,
    last_submitted_at: new Date().toISOString(),
  }
}

async function upsertTemplateRow(
  supabase: SupabaseClient,
  row: ReturnType<typeof buildUpsertRow>,
) {
  // TODO(account-sharing): conflict target is still scoped to
  // user_id. Once a follow-up migration drops the legacy unique
  // index on (user_id, name, language) and adds (account_id,
  // name, language), switch `onConflict` here so two teammates
  // can't shadow each other's same-named template.
  return supabase
    .from('message_templates')
    .upsert(row, { onConflict: 'user_id,name,language' })
    .select()
    .single()
}

/**
 * Submit a template to Meta for approval AND persist it locally.
 *
 * Auth → fetch whatsapp_config → validate → (DRY_RUN short-circuit) →
 * POST to Meta → upsert local row by (user_id, name, language) with
 * status, meta_template_id, sample_values, last_submitted_at.
 *
 * When WHATSAPP_TEMPLATES_DRY_RUN=true, we skip the network call and
 * insert a row with a synthetic `dry-run-<uuid>` meta_template_id so
 * CI / local dev can exercise the full UI without a real Meta App.
 *
 * On the Meta side this is a one-way trip — a row can only be
 * submitted; editing or deleting requires hsm_id and lives in PR 4.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve the caller's account_id — whatsapp_config + the
    // message_templates row are account-scoped post-multi-user.
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const accountId = profile?.account_id as string | undefined
    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 },
      )
    }

    let payload: TemplatePayload
    try {
      payload = (await request.json()) as TemplatePayload
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    if (payload.category === 'Authentication') {
      return NextResponse.json(
        {
          error:
            'AUTHENTICATION templates are not yet supported here — create them in Meta WhatsApp Manager and use "Sync from Meta".',
        },
        { status: 400 },
      )
    }

    try {
      validateTemplatePayload(payload)
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Validation failed.' },
        { status: 400 },
      )
    }

    const dryRun =
      process.env.WHATSAPP_TEMPLATES_DRY_RUN === 'true' ||
      process.env.WHATSAPP_TEMPLATES_DRY_RUN === '1'

    let metaTemplateId: string
    let metaStatus: string

    if (dryRun) {
      metaTemplateId = `dry-run-${crypto.randomUUID()}`
      metaStatus = 'PENDING'
    } else {
      const { data: config, error: configError } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('account_id', accountId)
        .single()
      if (configError || !config) {
        // No Meta config — save locally so the template is usable
        // for Evolution-based broadcasts and visible in pickers.
        await upsertTemplateRow(
          supabase,
          buildUpsertRow(accountId, user.id, payload, {
            status: 'local',
            metaTemplateId: null,
            submissionError: null,
          }),
        )
        return NextResponse.json(
          {
            success: true,
            local_only: true,
            message:
              'Plantilla guardada localmente. Conecta tu cuenta de Meta en Configuración para enviarla a aprobación.',
            error:
              'WhatsApp not configured. Connect your WhatsApp Business account in Settings first.',
          },
          { status: 200 },
        )
      }
      if (!config.waba_id) {
        // Config exists but WABA ID missing — save locally, template
        // is still usable for Evolution broadcasts.
        await upsertTemplateRow(
          supabase,
          buildUpsertRow(accountId, user.id, payload, {
            status: 'local',
            metaTemplateId: null,
            submissionError: null,
          }),
        )
        return NextResponse.json(
          {
            success: true,
            local_only: true,
            message:
              'Plantilla guardada localmente. Configura tu WABA ID en Ajustes para enviarla a Meta.',
            error:
              'WABA (WhatsApp Business Account) ID missing. Re-connect your account in Settings.',
          },
          { status: 200 },
        )
      }

      const accessToken = decrypt(config.access_token)

      // ── Detect token integrity *before* calling Meta ─────────────
      // If the decrypted token looks empty / garbled / expired, or if
      // the entire account is running on Evolution (no Meta), save the
      // template locally as DRAFT so it stays usable for Evo broadcasts
      // and the user isn't blocked by a broken Meta integration.
      const isEvolution = process.env.WHATSAPP_PROVIDER === 'evolution'
      if (isEvolution) {
        // Evolution mode — no Meta submission, local-only save with
        // 'local' status so it appears in pickers immediately.
        const { data: row } = await upsertTemplateRow(
          supabase,
          buildUpsertRow(accountId, user.id, payload, {
            status: 'local',
            metaTemplateId: null,
            submissionError: null,
          }),
        )
        return NextResponse.json({
          success: true,
          template: row,
          local_only: true,
          message:
            'Plantilla guardada localmente (modo Evolution). Puedes usarla en difusiones rápidas.',
        })
      }

      if (!accessToken || accessToken.length < 10) {
        // Token is broken — save locally so the template isn't lost.
        await upsertTemplateRow(
          supabase,
          buildUpsertRow(accountId, user.id, payload, {
            status: 'local',
            metaTemplateId: null,
            submissionError: null,
          }),
        )
        return NextResponse.json(
          {
            success: true,
            local_only: true,
            message:
              'Plantilla guardada localmente. El token de Meta no es válido.',
            error:
              'Token de acceso de Meta no configurado o inválido. Revisa las credenciales en Configuración → WhatsApp.',
          },
          { status: 200 },
        )
      }

      // Image headers need a Resumable-Upload handle (Meta rejects a
      // plain URL at creation). Derive it from header_media_url before
      // building the payload. Surfaces a 400 with an actionable message
      // (missing META_APP_ID, unreachable URL, wrong type/size).
      try {
        await ensureImageHeaderHandle(payload, accessToken)
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'Header image upload failed.' },
          { status: 400 },
        )
      }

      const metaPayload = buildMetaTemplatePayload(payload)
      try {
        const meta = await submitMessageTemplate({
          wabaId: config.waba_id,
          accessToken,
          payload: metaPayload,
        })
        metaTemplateId = meta.id
        metaStatus = meta.status
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Meta submit failed.'
        // Persist the failure so the user can retry; row stays DRAFT
        // until they fix and re-submit.
        await upsertTemplateRow(
          supabase,
          buildUpsertRow(accountId, user.id, payload, {
            status: 'DRAFT',
            metaTemplateId: null,
            submissionError: message,
          }),
        )

        // Detect known Meta error classes and surface actionable
        // Spanish messages instead of raw API noise.
        const isAuthError =
          /(OAuth|access.?token|token.*invalid|token.*expired|auth.*failed|parse.*token)/i.test(
            message,
          )
        const isRateLimit = /\b429\b/.test(message)
        const isPermissionError =
          /(#200|#10|permission|not.*authorized|scope)/i.test(message)

        if (isAuthError) {
          return NextResponse.json(
            {
              error:
                'No se pudo enviar la plantilla a Meta: Token de acceso inválido o expirado. ' +
                'Ve a Configuración → WhatsApp y re-conecta tu cuenta de Meta.',
              meta_error: message,
              saved_as_draft: true,
            },
            { status: 401 },
          )
        }
        if (isPermissionError) {
          return NextResponse.json(
            {
              error:
                'Meta rechazó la plantilla por falta de permisos. ' +
                'Asegúrate de que tu app de Meta tenga los scopes whatsapp_business_management y business_management.',
              meta_error: message,
              saved_as_draft: true,
            },
            { status: 403 },
          )
        }
        if (isRateLimit) {
          return NextResponse.json(
            {
              error:
                'Límite de Meta alcanzado (100 plantillas por hora). Inténtalo de nuevo más tarde.',
            },
            { status: 429 },
          )
        }

        return NextResponse.json(
          { error: message },
          { status: 502 },
        )
      }
    }

    const { data: row, error: upsertErr } = await upsertTemplateRow(
      supabase,
      buildUpsertRow(accountId, user.id, payload, {
        status: normalizeStatus(metaStatus),
        metaTemplateId,
        submissionError: null,
      }),
    )

    if (upsertErr) {
      // The submit succeeded on Meta's side but we failed to persist
      // locally. That's a data-drift state — surface the meta_template_id
      // so the user can recover via "Sync from Meta".
      return NextResponse.json(
        {
          error: `Submitted to Meta but failed to save locally: ${upsertErr.message}. Run "Sync from Meta" to recover.`,
          meta_template_id: metaTemplateId,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      template: row,
      dry_run: dryRun,
    })
  } catch (error) {
    console.error('Error submitting template:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to submit template.',
      },
      { status: 500 },
    )
  }
}
