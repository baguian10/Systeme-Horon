'use client';

import { useActionState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { sendContactAction } from './actions';

const INPUT = 'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent';

const SUBJECTS = [
  'Question sur le programme TIG',
  'Problème avec le bracelet GPS',
  'Demande de modification de zone',
  'Réclamation / signalement',
  'Demande de documentation officielle',
  'Partenariat / presse',
  'Autre',
];

export default function ContactForm() {
  const [state, formAction, isPending] = useActionState(sendContactAction, null);

  if (state?.success) {
    return (
      <div className="px-6 py-12 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
        <p className="text-base font-bold text-gray-900 mb-1">Message envoyé</p>
        <p className="text-sm text-gray-500 leading-relaxed">
          Votre message a bien été reçu. Un agent SIGEP vous répondra dans un délai de 48 heures ouvrées
          à l&apos;adresse email que vous avez indiquée.
        </p>
        <p className="text-xs text-gray-400 mt-4">Numéro de référence : <strong className="font-mono">{state.ref}</strong></p>
      </div>
    );
  }

  return (
    <form action={formAction} className="px-6 py-5 space-y-4">
      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Nom complet *</label>
          <input name="name" type="text" required placeholder="Prénom Nom" className={INPUT} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Téléphone</label>
          <input name="phone" type="tel" placeholder="+226 XX XX XX XX" className={INPUT} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Adresse email *</label>
        <input name="email" type="email" required placeholder="votre@email.com" className={INPUT} />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Objet de la demande *</label>
        <select name="subject" required className={INPUT}>
          <option value="">Sélectionner…</option>
          {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">N° de dossier (si applicable)</label>
        <input name="case_number" type="text" placeholder="TIG-2024-XXXX" className={INPUT} />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Message *</label>
        <textarea
          name="message"
          required
          rows={4}
          placeholder="Décrivez votre demande en détail…"
          className={`${INPUT} resize-none`}
        />
      </div>

      <div className="flex items-start gap-2">
        <input type="checkbox" name="consent" required id="consent" className="mt-1 accent-emerald-600" />
        <label htmlFor="consent" className="text-xs text-gray-500 leading-relaxed">
          J&apos;accepte que mes données soient traitées conformément à la politique de confidentialité du Ministère de la Justice du Burkina Faso, dans le cadre unique de ma demande.
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50 transition-colors"
      >
        <Send className="w-4 h-4" />
        {isPending ? 'Envoi en cours…' : 'Envoyer le message'}
      </button>
    </form>
  );
}
