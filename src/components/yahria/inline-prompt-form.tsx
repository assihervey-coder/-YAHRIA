'use client';

// ═══════════════════════════════════════════════════════════════
// YAHRIA MISSION CONTROL — Formulaire de saisie gouverné INLINE
//
// Défaut mesuré (EVO-000026, reproduit sur EVO-000028) : window.prompt
// est MUET en iframe/webview — le navigateur le bloque sans ouvrir de
// fenêtre et renvoie null silencieusement → bouton « mort » sans
// feedback (l'utilisateur voit « la fenêtre [qui] ne s'ouvre pas en
// iframe »). Ce composant rend la saisie INLINE — fiable en iframe,
// en webview et en fenêtre pleine — avec validation VISIBLE au lieu
// du return silencieux. Pattern issu du formulaire de décision
// inline d'EvolutionPanel (EVO-000026), généralisé à toute saisie
// gouvernée (INV-163 rollback, INV-162 expérimentation, INV-200/201/222
// raisons gouvernées).
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ChevronRight } from 'lucide-react';

export interface InlinePromptField {
  key: string;
  placeholder: string;
  minLength: number;
}

export function InlinePromptForm({ title, fields, confirmLabel, busy, onConfirm, onCancel }: {
  title: string;
  fields: InlinePromptField[];
  confirmLabel: string;
  busy?: boolean;
  onConfirm: (values: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  const confirm = () => {
    for (const f of fields) {
      if ((values[f.key] ?? '').trim().length < f.minLength) {
        setErr(`Saisie incomplète : « ${f.placeholder} » exige ${f.minLength} caractères minimum.`);
        return;
      }
    }
    setErr(null);
    onConfirm(values);
  };

  return (
    <div className="w-full rounded-md border border-teal-700/50 bg-slate-900/80 p-3 space-y-2">
      <div className="text-[11px] font-mono text-teal-300">{title}</div>
      {fields.map((f) => (
        <Input
          key={f.key}
          className="h-8 text-[11px] bg-slate-950 border-slate-700"
          placeholder={`${f.placeholder} (≥ ${f.minLength} caractères)`}
          value={values[f.key] ?? ''}
          onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
        />
      ))}
      {err && (
        <div className="text-[10px] text-red-300 border border-red-500/40 bg-red-500/10 rounded-md p-2">{err}</div>
      )}
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-[11px] bg-teal-600 hover:bg-teal-500 text-white" onClick={confirm} disabled={busy}>
          {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ChevronRight className="h-3 w-3 mr-1" />} {confirmLabel}
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={onCancel}>Annuler</Button>
      </div>
    </div>
  );
}
