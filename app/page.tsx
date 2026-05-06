import Link from "next/link";
import {
  Lock,
  ShieldCheck,
  MapPin,
  Activity,
  AlertTriangle,
  FileText,
  Package,
  Radio,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      {/* ── Navigation ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-900 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-blue-900 tracking-tight text-lg">
              Système Horon
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#mission" className="hover:text-blue-900 transition-colors">
              Mission
            </a>
            <a href="#technologie" className="hover:text-blue-900 transition-colors">
              Technologie
            </a>
            <a href="#processus" className="hover:text-blue-900 transition-colors">
              Processus
            </a>
          </nav>
          <Link
            href="/sigep"
            className="p-2 rounded-lg text-gray-400 hover:text-blue-900 hover:bg-blue-50 transition-all"
            title="Accès SIGEP réservé au personnel autorisé"
          >
            <Lock className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="pt-32 pb-24 px-6 bg-gradient-to-b from-blue-950 to-blue-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-800/60 border border-blue-700 rounded-full px-4 py-1.5 text-sm font-medium text-blue-200 mb-8">
            <ShieldCheck className="w-4 h-4" />
            République du Mali — Ministère de la Justice
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
            Surveillance électronique
            <span className="block text-blue-300">au service de la réhabilitation</span>
          </h1>
          <p className="text-xl text-blue-200 max-w-2xl mx-auto leading-relaxed mb-10">
            Le Système Horon offre une alternative moderne à la détention provisoire,
            protégeant la présomption d'innocence tout en garantissant la sécurité publique
            grâce à une technologie de surveillance certifiée.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#processus"
              className="px-8 py-3.5 rounded-xl bg-white text-blue-900 font-semibold hover:bg-blue-50 transition-colors"
            >
              Voir le processus
            </a>
            <a
              href="#technologie"
              className="px-8 py-3.5 rounded-xl border border-blue-600 text-white font-semibold hover:bg-blue-800 transition-colors"
            >
              La technologie
            </a>
          </div>
        </div>
      </section>

      {/* ── Mission Stats ── */}
      <section id="mission" className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Une justice plus humaine
            </h2>
            <p className="text-lg text-gray-600 max-w-xl mx-auto">
              La surveillance électronique réduit la surpopulation carcérale et favorise
              la réinsertion tout en maintenant le contrôle judiciaire.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { value: "73%", label: "Réduction du risque de récidive", sub: "vs détention classique" },
              { value: "24/7", label: "Surveillance continue", sub: "sans interruption" },
              { value: "<2s", label: "Délai d'alerte", sub: "en cas d'incident" },
            ].map((stat) => (
              <div
                key={stat.value}
                className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm"
              >
                <p className="text-4xl font-bold text-blue-900 mb-2">{stat.value}</p>
                <p className="font-semibold text-gray-900 mb-1">{stat.label}</p>
                <p className="text-sm text-gray-500">{stat.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Technologie ThinkRace TR40 ── */}
      <section id="technologie" className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">
              Équipement certifié
            </p>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Bracelet ThinkRace TR40
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Un dispositif de surveillance de nouvelle génération, homologué pour usage
              judiciaire, combinant précision GPS et monitoring de santé en temps réel.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: <MapPin className="w-6 h-6" />,
                title: "Localisation GPS précise",
                desc: "Positionnement en temps réel avec précision métrique via GPS/GLONASS/BeiDou. Mise à jour toutes les 30 secondes en zone active.",
              },
              {
                icon: <ShieldCheck className="w-6 h-6" />,
                title: "Géofence configurable",
                desc: "Définition de zones d'inclusion et d'exclusion par le juge. Alerte immédiate en cas de franchissement non autorisé.",
              },
              {
                icon: <Activity className="w-6 h-6" />,
                title: "Monitoring de santé",
                desc: "Surveillance continue du rythme cardiaque et de l'oxymétrie. Détection des situations de détresse médicale.",
              },
              {
                icon: <AlertTriangle className="w-6 h-6" />,
                title: "Anti-sabotage",
                desc: "Capteurs de pression et de conductivité cutanée. Alerte immédiate en cas de tentative de retrait ou de manipulation.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="flex gap-5 p-6 rounded-2xl border border-gray-100 hover:border-blue-100 hover:bg-blue-50/30 transition-all"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-900 text-white flex items-center justify-center">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1.5">{feature.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Processus ── */}
      <section id="processus" className="py-24 px-6 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-3">
              Comment ça fonctionne
            </p>
            <h2 className="text-3xl font-bold text-gray-900">
              Trois étapes, une justice équilibrée
            </h2>
          </div>

          <div className="relative">
            <div className="hidden md:block absolute left-[2.75rem] top-12 bottom-12 w-px bg-gradient-to-b from-blue-200 via-blue-400 to-blue-200" />

            <div className="space-y-8">
              {[
                {
                  step: "01",
                  icon: <FileText className="w-6 h-6" />,
                  title: "Ordonnance judiciaire",
                  desc: "Le juge d'instruction ou le tribunal évalue le dossier et ordonne le placement sous surveillance électronique comme alternative à la détention provisoire. Il définit les conditions : périmètre autorisé, horaires, obligations de présence.",
                },
                {
                  step: "02",
                  icon: <Package className="w-6 h-6" />,
                  title: "Équipement & configuration",
                  desc: "Un agent SIGEP spécialisé procède à la pose du bracelet ThinkRace TR40 et configure les paramètres dans le système : géofences personnalisées, contacts d'urgence, fréquence de reporting. L'identité biométrique est enregistrée.",
                },
                {
                  step: "03",
                  icon: <Radio className="w-6 h-6" />,
                  title: "Surveillance & suivi",
                  desc: "Le centre de monitoring opère 24h/24. Toute anomalie (sortie de zone, alerte santé, tentative de sabotage) déclenche une notification en temps réel aux agents de terrain et au juge responsable du dossier via SIGEP.",
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-6 items-start">
                  <div className="flex-shrink-0 relative z-10 w-14 h-14 rounded-2xl bg-blue-900 text-white flex flex-col items-center justify-center shadow-lg">
                    {item.icon}
                    <span className="text-[9px] font-bold text-blue-300 mt-0.5">{item.step}</span>
                  </div>
                  <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="font-semibold text-gray-900 text-lg mb-2">{item.title}</h3>
                    <p className="text-gray-600 leading-relaxed text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-900" />
            <span>Système Horon — République du Mali</span>
          </div>
          <p>© {new Date().getFullYear()} Ministère de la Justice. Tous droits réservés.</p>
          <p className="text-xs">Usage strictement institutionnel</p>
        </div>
      </footer>
    </div>
  );
}
