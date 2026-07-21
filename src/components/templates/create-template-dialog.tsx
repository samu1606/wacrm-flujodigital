"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Info,
  X,
  Upload,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  uploadAccountMedia,
  MEDIA_MAX_BYTES_BY_KIND,
} from "@/lib/storage/upload-media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  MessageTemplate,
  TemplateButton,
  TemplateSampleValues,
} from "@/types";
import {
  extractVariableIndices,
  TEMPLATE_LIMITS,
} from "@/lib/whatsapp/template-validators";

// ─── Types ───────────────────────────────────────────────────────────

const CATEGORIES = ["Marketing", "Utility", "Authentication"] as const;
type HeaderFormat = "none" | "text" | "image" | "video" | "document";
const HEADER_FORMATS: HeaderFormat[] = [
  "none",
  "text",
  "image",
  "video",
  "document",
];

interface TemplateFormData {
  name: string;
  category: MessageTemplate["category"];
  language: string;
  header_format: HeaderFormat;
  header_content: string;
  header_media_url: string;
  header_sample: string;
  body_text: string;
  body_samples: string[];
  footer_text: string;
  buttons: TemplateButton[];
}

const emptyForm: TemplateFormData = {
  name: "",
  category: "Marketing",
  language: "en_US",
  header_format: "none",
  header_content: "",
  header_media_url: "",
  header_sample: "",
  body_text: "",
  body_samples: [],
  footer_text: "",
  buttons: [],
};

const COMMON_LANGUAGE_CODES = [
  "en_US",
  "en_GB",
  "en",
  "es",
  "es_ES",
  "es_MX",
  "fr",
  "fr_FR",
  "de",
  "it",
  "pt_BR",
  "pt_PT",
  "nl",
  "pl",
  "ru",
  "tr",
  "lt",
];

function emptyButton(type: TemplateButton["type"]): TemplateButton {
  switch (type) {
    case "QUICK_REPLY":
      return { type: "QUICK_REPLY", text: "" };
    case "URL":
      return { type: "URL", text: "", url: "" };
    case "PHONE_NUMBER":
      return { type: "PHONE_NUMBER", text: "", phone_number: "" };
    case "COPY_CODE":
      return { type: "COPY_CODE", text: "", example: "" };
  }
}

// ─── Props ───────────────────────────────────────────────────────────

export interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful creation (both dry-run & real submit). */
  onSuccess?: () => void;
  /** Label override for the trigger button shown inside pickers. */
  triggerLabel?: string;
}

// ─── Component ───────────────────────────────────────────────────────

export function CreateTemplateDialog({
  open,
  onOpenChange,
  onSuccess,
  triggerLabel,
}: CreateTemplateDialogProps) {
  const { user } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<TemplateFormData>(emptyForm);
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const headerFileRef = useRef<HTMLInputElement>(null);

  // ── Variable counting ─────────────────────────────────────────────

  const bodyVarCount = useMemo(
    () => extractVariableIndices(form.body_text).length,
    [form.body_text],
  );
  const headerVarCount = useMemo(
    () =>
      form.header_format === "text"
        ? extractVariableIndices(form.header_content).length
        : 0,
    [form.header_format, form.header_content],
  );

  // ── Button helpers ────────────────────────────────────────────────

  type ButtonPatch = {
    text?: string;
    url?: string;
    phone_number?: string;
    example?: string;
  };
  function updateButton(index: number, patch: ButtonPatch) {
    setForm((prev) => {
      const current = prev.buttons[index];
      if (!current) return prev;
      const next = [...prev.buttons];
      switch (current.type) {
        case "QUICK_REPLY":
          next[index] = {
            ...current,
            ...(patch.text !== undefined && { text: patch.text }),
          };
          break;
        case "URL":
          next[index] = {
            ...current,
            ...(patch.text !== undefined && { text: patch.text }),
            ...(patch.url !== undefined && { url: patch.url }),
            ...(patch.example !== undefined && { example: patch.example }),
          };
          break;
        case "PHONE_NUMBER":
          next[index] = {
            ...current,
            ...(patch.text !== undefined && { text: patch.text }),
            ...(patch.phone_number !== undefined && {
              phone_number: patch.phone_number,
            }),
          };
          break;
        case "COPY_CODE":
          next[index] = {
            ...current,
            ...(patch.text !== undefined && { text: patch.text }),
            ...(patch.example !== undefined && { example: patch.example }),
          };
          break;
      }
      return { ...prev, buttons: next };
    });
  }

  function changeButtonType(index: number, type: TemplateButton["type"]) {
    setForm((prev) => {
      const next = [...prev.buttons];
      next[index] = emptyButton(type);
      return { ...prev, buttons: next };
    });
  }

  function removeButton(index: number) {
    setForm((prev) => ({
      ...prev,
      buttons: prev.buttons.filter((_, i) => i !== index),
    }));
  }

  function addButton() {
    if (form.buttons.length >= TEMPLATE_LIMITS.maxButtonsTotal) return;
    setForm((prev) => ({
      ...prev,
      buttons: [...prev.buttons, emptyButton("QUICK_REPLY")],
    }));
  }

  // ── Header image upload ───────────────────────────────────────────

  async function handleHeaderImageFile(file: File) {
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Only JPEG and PNG images are accepted.");
      return;
    }
    if (file.size > MEDIA_MAX_BYTES_BY_KIND.image) {
      toast.error(
        `Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB).`,
      );
      return;
    }
    setUploadingHeader(true);
    try {
      const { publicUrl } = await uploadAccountMedia("chat-media", file);
      setForm((f) => ({ ...f, header_media_url: publicUrl }));
      toast.success("Image uploaded.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Upload failed.",
      );
    } finally {
      setUploadingHeader(false);
    }
  }

  // ── Submit ────────────────────────────────────────────────────────

  function buildSubmitPayload() {
    const sample_values: TemplateSampleValues = {};
    if (form.body_samples.some((v) => v.trim())) {
      sample_values.body = form.body_samples.map((v) => v.trim());
    }
    if (form.header_format === "text" && form.header_sample.trim()) {
      sample_values.header = [form.header_sample.trim()];
    }

    return {
      name: form.name.trim(),
      category: form.category,
      language: form.language.trim() || "en_US",
      header_type:
        form.header_format === "none" ? undefined : form.header_format,
      header_content:
        form.header_format === "text"
          ? form.header_content.trim()
          : undefined,
      header_media_url:
        form.header_format !== "none" && form.header_format !== "text"
          ? form.header_media_url.trim() || undefined
          : undefined,
      body_text: form.body_text.trim(),
      footer_text: form.footer_text.trim() || undefined,
      buttons: form.buttons.length > 0 ? form.buttons : undefined,
      sample_values:
        Object.keys(sample_values).length > 0 ? sample_values : undefined,
    };
  }

  async function handleSubmit() {
    if (form.category === "Authentication") return;
    try {
      setSubmitting(true);
      const res = await fetch("/api/whatsapp/templates/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSubmitPayload()),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data?.error || `Submit failed (HTTP ${res.status})`,
        );
      }
      toast.success(
        data.dry_run
          ? "Template saved locally (dry-run mode)."
          : "Template submitted for approval.",
      );
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      console.error("Submit error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to create template.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) setForm(emptyForm);
    onOpenChange(next);
  }

  // ── Derived ───────────────────────────────────────────────────────

  const headerNeedsMedia =
    form.header_format !== "none" && form.header_format !== "text";

  // ── Render ────────────────────────────────────────────────────────

  return (
    <>
      {/* Optional inline trigger button — used inside pickers / wizards
          where there's no dedicated toolbar button. */}
      {triggerLabel && !open && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(true)}
          className="gap-1 border-border text-muted-foreground hover:bg-muted h-8 text-xs"
        >
          <Plus className="size-3.5" />
          {triggerLabel}
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="bg-popover border-border sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">
              New Template
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Fill in the fields below to create a new WhatsApp message
              template. It will be submitted to Meta for approval.
            </DialogDescription>
          </DialogHeader>

          {form.category === "Authentication" && (
            <div className="flex items-start gap-2 rounded border border-blue-800/40 bg-blue-950/20 px-3 py-2 text-xs text-blue-300">
              <Info className="size-4 mt-0.5 shrink-0" />
              <p>
                <strong>Nota:</strong> Las plantillas de autenticación
                (OTP/Códigos) requieren verificación de negocio en Meta
                y no pueden usarse para difusiones masivas.
              </p>
            </div>
          )}

          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Template name</Label>
              <Input
                placeholder="order_confirmation"
                value={form.name}
                onChange={(e) => {
                  // Auto-slug: lowercase + spaces → underscores.
                  // Meta only accepts [a-z0-9_], so we transform on
                  // every keystroke to prevent submission errors.
                  const slugged = e.target.value
                    .toLowerCase()
                    .replace(/\s+/g, "_");
                  setForm({ ...form, name: slugged });
                }}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-[11px] text-muted-foreground">
                Lowercase letters, digits, and underscores only.
              </p>
            </div>

            {/* Category + Language */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(val) =>
                    setForm({
                      ...form,
                      category: val as MessageTemplate["category"],
                    })
                  }
                >
                  <SelectTrigger className="w-full bg-muted border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {CATEGORIES.map((cat) => (
                      <SelectItem
                        key={cat}
                        value={cat}
                        className="text-popover-foreground focus:bg-muted focus:text-popover-foreground"
                      >
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Language</Label>
                <Input
                  list="ctd-language-codes"
                  placeholder="en_US"
                  value={form.language}
                  onChange={(e) =>
                    setForm({ ...form, language: e.target.value })
                  }
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
                <datalist id="ctd-language-codes">
                  {COMMON_LANGUAGE_CODES.map((code) => (
                    <option key={code} value={code} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Header */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Header</Label>
              <Select
                value={form.header_format}
                onValueChange={(val) => {
                  if (!val) return;
                  setForm({
                    ...form,
                    header_format: val as HeaderFormat,
                  });
                }}
              >
                <SelectTrigger className="w-full bg-muted border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {HEADER_FORMATS.map((type) => (
                    <SelectItem
                      key={type}
                      value={type}
                      className="text-popover-foreground focus:bg-muted focus:text-popover-foreground"
                    >
                      {type === "none"
                        ? "None"
                        : type === "text"
                          ? "Text"
                          : type === "image"
                            ? "Image"
                            : type === "video"
                              ? "Video"
                              : "Document"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {form.header_format === "text" && (
                <div className="space-y-2 mt-2">
                  <Input
                    aria-label="Header text"
                    placeholder="Header text (optional {{1}})"
                    value={form.header_content}
                    onChange={(e) =>
                      setForm({ ...form, header_content: e.target.value })
                    }
                    maxLength={TEMPLATE_LIMITS.headerTextMaxLength}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                  {headerVarCount > 0 && (
                    <Input
                      aria-label="Header sample value"
                      placeholder='Sample value for {{1}}'
                      value={form.header_sample}
                      onChange={(e) =>
                        setForm({ ...form, header_sample: e.target.value })
                      }
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                    />
                  )}
                </div>
              )}

              {headerNeedsMedia && (
                <div className="space-y-2 mt-2">
                  {form.header_format === "image" && (
                    <div className="flex items-center gap-2">
                      <input
                        ref={headerFileRef}
                        type="file"
                        accept="image/jpeg,image/png"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleHeaderImageFile(f);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingHeader}
                        onClick={() => headerFileRef.current?.click()}
                      >
                        {uploadingHeader ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        Upload Image
                      </Button>
                      <span className="text-[11px] text-muted-foreground">
                        JPEG/PNG only
                      </span>
                    </div>
                  )}
                  <Input
                    placeholder={
                      form.header_format === "image"
                        ? "https://example.com/header.jpg"
                        : `Media URL for ${form.header_format} header`
                    }
                    value={form.header_media_url}
                    onChange={(e) =>
                      setForm({ ...form, header_media_url: e.target.value })
                    }
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                  {form.header_format === "image" && form.header_media_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.header_media_url}
                      alt="Header sample"
                      className="max-h-28 rounded-md border border-border object-contain"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Body text</Label>
              <Textarea
                placeholder="Hi {{1}}, your order has been confirmed!"
                value={form.body_text}
                onChange={(e) =>
                  setForm({ ...form, body_text: e.target.value })
                }
                rows={4}
                maxLength={TEMPLATE_LIMITS.bodyMaxLength}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                Use {"{{1}}"}, {"{{2}}"}, etc. for variables. Must be
                contiguous starting at {"{{1}}"}.
              </p>

              {bodyVarCount > 0 && (
                <div className="space-y-1.5 pt-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Sample values
                  </Label>
                  {form.body_samples.map((val, i) => (
                    <Input
                      key={i}
                      aria-label={`Sample value for {{${i + 1}}}`}
                      placeholder={`Value for {{${i + 1}}}`}
                      value={val}
                      onChange={(e) => {
                        const next = [...form.body_samples];
                        next[i] = e.target.value;
                        setForm({ ...form, body_samples: next });
                      }}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Footer</Label>
              <Input
                placeholder="Reply STOP to opt out"
                value={form.footer_text}
                onChange={(e) =>
                  setForm({ ...form, footer_text: e.target.value })
                }
                maxLength={TEMPLATE_LIMITS.footerMaxLength}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* Buttons */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-muted-foreground">Buttons</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addButton}
                  disabled={
                    form.buttons.length >= TEMPLATE_LIMITS.maxButtonsTotal
                  }
                  className="border-border bg-transparent text-muted-foreground hover:bg-muted h-7 text-xs"
                >
                  <Plus className="size-3" />
                  Add button
                </Button>
              </div>
              {form.buttons.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Up to {TEMPLATE_LIMITS.maxButtonsTotal} buttons (max{" "}
                  {TEMPLATE_LIMITS.maxUrlButtons} URL,{" "}
                  {TEMPLATE_LIMITS.maxPhoneButtons} phone,{" "}
                  {TEMPLATE_LIMITS.maxCopyCodeButtons} copy code).
                </p>
              ) : (
                <div className="space-y-2">
                  {form.buttons.map((btn, i) => (
                    <div
                      key={i}
                      className="space-y-2 rounded border border-border bg-muted/50 p-2"
                    >
                      <div className="flex items-center gap-2">
                        <Select
                          value={btn.type}
                          onValueChange={(val) => {
                            if (!val) return;
                            changeButtonType(
                              i,
                              val as TemplateButton["type"],
                            );
                          }}
                        >
                          <SelectTrigger className="w-40 bg-muted border-border text-foreground h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border">
                            <SelectItem
                              value="QUICK_REPLY"
                              className="text-popover-foreground focus:bg-muted focus:text-popover-foreground"
                            >
                              Quick Reply
                            </SelectItem>
                            <SelectItem
                              value="URL"
                              className="text-popover-foreground focus:bg-muted focus:text-popover-foreground"
                            >
                              URL
                            </SelectItem>
                            <SelectItem
                              value="PHONE_NUMBER"
                              className="text-popover-foreground focus:bg-muted focus:text-popover-foreground"
                            >
                              Phone
                            </SelectItem>
                            <SelectItem
                              value="COPY_CODE"
                              className="text-popover-foreground focus:bg-muted focus:text-popover-foreground"
                            >
                              Copy Code
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Button label"
                          value={btn.text}
                          maxLength={TEMPLATE_LIMITS.buttonTextMaxLength}
                          onChange={(e) =>
                            updateButton(i, { text: e.target.value })
                          }
                          className="flex-1 bg-muted border-border text-foreground placeholder:text-muted-foreground h-8 text-xs"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeButton(i)}
                          className="text-muted-foreground hover:text-red-400 hover:bg-red-950/30 size-7"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                      {btn.type === "URL" && (
                        <div className="space-y-1 pl-1">
                          <Input
                            placeholder="https://example.com/{{1}}"
                            value={btn.url}
                            onChange={(e) =>
                              updateButton(i, { url: e.target.value })
                            }
                            className="bg-muted border-border text-foreground placeholder:text-muted-foreground h-8 text-xs"
                          />
                          {extractVariableIndices(btn.url).length > 0 && (
                            <Input
                              placeholder="Example value for {{1}}"
                              value={btn.example ?? ""}
                              onChange={(e) =>
                                updateButton(i, { example: e.target.value })
                              }
                              className="bg-muted border-border text-foreground placeholder:text-muted-foreground h-8 text-xs"
                            />
                          )}
                        </div>
                      )}
                      {btn.type === "PHONE_NUMBER" && (
                        <Input
                          placeholder="+1234567890"
                          value={btn.phone_number}
                          onChange={(e) =>
                            updateButton(i, {
                              phone_number: e.target.value,
                            })
                          }
                          className="bg-muted border-border text-foreground placeholder:text-muted-foreground h-8 text-xs"
                        />
                      )}
                      {btn.type === "COPY_CODE" && (
                        <Input
                          placeholder="e.g. SAVE10"
                          value={btn.example}
                          onChange={(e) =>
                            updateButton(i, { example: e.target.value })
                          }
                          className="bg-muted border-border text-foreground placeholder:text-muted-foreground h-8 text-xs"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="bg-popover border-border">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                submitting ||
                form.category === "Authentication" ||
                !user
              }
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit for Approval"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Convenience hook: local open state + callbacks for inline use inside
 * pickers / wizards that want a single "New Template" button that opens
 * the dialog and refreshes the template list on success.
 */
export function useCreateTemplateDialog() {
  const [open, setOpen] = useState(false);
  return {
    open,
    setOpen,
    /** Pass to CreateTemplateDialog.onOpenChange */
    onOpenChange: setOpen,
  };
}
