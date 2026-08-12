import Link from 'next/link';
import {
  ArrowRight, Activity, MapPin, FolderOpen, Bell, FileText,
  FlaskConical, Presentation,
} from 'lucide-react';
import { IS_DEMO_MODE } from '@/lib/demo-mode';

// Homepage block shown only on the demonstration deployment: it invites the
// visiting authority to walk through the platform, and states plainly that the
// data is fabricated. Self-gating on IS_DEMO_MODE — the real public site never
// renders it.
export default function DemoHomeSection() {
  if (!IS_DEMO_MODE) return null;
  return (
    <section className="py-16 px-6 bg-gradient-to-b from-white to-slate-50 border-b border-slate-100">
      <div className="max-w-5xl mx-auto">
        <div className="rounded-3xl border border-emerald-100 bg-white shadow-xl shadow-emerald-900/5 overflow-hidden grid md:grid-cols-5">
          <div className="md:col-span-3 p-8 md:p-10">
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5 mb-5">
              <FlaskConical className="w-3.5 h-3.5 text-amber-700" />
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-widest">
                Démonstration officielle · données fictives
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight mb-4">
              Explorez le SIGEP en conditions réelles
            </h2>
            <p className="text-slate-600 leading-relaxed mb-6">
              Cette plateforme reproduit l&apos;intégralité du Système Intégré de Gestion des Peines : dossiers, alertes,
              bracelets, cartes, sites de travail d&apos;intérêt général et rapports — à partir de données entièrement
              simulées. Aucune donnée personnelle réelle n&apos;est manipulée. Naviguez librement, une visite guidée
              vous accompagne.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/sigep/dashboard"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-600/20"
              >
                Entrer dans le tableau de bord <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/sigep/login"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
              >
                Explorer les rôles (magistrat, agent…)
              </Link>
              <a
                href="/presentation.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
              >
                <Presentation className="w-4 h-4" /> Voir la présentation
              </a>
            </div>
          </div>
          <div className="md:col-span-2 bg-slate-900 p-8 flex flex-col justify-center gap-4">
            {[
              { icon: <Activity className="w-4 h-4" />,   label: 'Surveillance en temps réel' },
              { icon: <MapPin className="w-4 h-4" />,     label: 'Cartes, zones & itinéraires' },
              { icon: <FolderOpen className="w-4 h-4" />, label: 'Dossiers des personnes suivies' },
              { icon: <Bell className="w-4 h-4" />,       label: 'Alertes & infractions' },
              { icon: <FileText className="w-4 h-4" />,   label: 'Suivi TIG & rapports judiciaires' },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-3 text-slate-200">
                <span className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  {f.icon}
                </span>
                <span className="text-sm font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
