import Link from 'next/link';
import { Newspaper, Calendar, Tag, ChevronRight, ExternalLink } from 'lucide-react';

export const metadata = {
  title: 'Actualités & Communiqués — Système Horon',
  description: 'Communiqués officiels, bilans trimestriels et événements du programme national TIG du Burkina Faso.',
};

type Category = 'Communiqué' | 'Rapport' | 'Événement' | 'Partenariat';

interface Article {
  id:       string;
  date:     string;
  category: Category;
  title:    string;
  excerpt:  string;
  featured: boolean;
  source:   string;
}

const CAT_STYLES: Record<Category, string> = {
  'Communiqué':  'bg-blue-50 text-blue-700 border-blue-200',
  'Rapport':     'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Événement':   'bg-purple-50 text-purple-700 border-purple-200',
  'Partenariat': 'bg-amber-50 text-amber-700 border-amber-200',
};

const ARTICLES: Article[] = [
  {
    id: 'a-001',
    date: '15 avril 2024',
    category: 'Rapport',
    title: 'Bilan du 1er trimestre 2024 — 47 bénéficiaires actifs dans le programme TIG',
    excerpt: 'Le programme national TIG atteint un nouveau palier avec 47 bénéficiaires actifs sous surveillance électronique au 31 mars 2024. Le taux de conformité s\'établit à 91,5%, dépassant l\'objectif annuel de 85%. La durée moyenne des prestations est de 3 mois et 12 jours.',
    featured: true,
    source: 'Direction de la Réinsertion Judiciaire — MJDH',
  },
  {
    id: 'a-002',
    date: '22 mars 2024',
    category: 'Partenariat',
    title: 'Convention signée avec l\'UNODC pour renforcer le programme TIG',
    excerpt: 'Le Ministre de la Justice et des Droits Humains a signé une convention de coopération technique avec le Bureau des Nations Unies contre la Drogue et le Crime (UNODC). Ce partenariat prévoit un appui technique et financier de 850 000 USD sur 3 ans pour renforcer les capacités du programme Horon.',
    featured: false,
    source: 'Cabinet du Ministre — MJDH',
  },
  {
    id: 'a-003',
    date: '8 mars 2024',
    category: 'Événement',
    title: 'Formation de 24 agents SIGEP aux nouvelles procédures de surveillance',
    excerpt: 'Une session de formation de 5 jours a été organisée au Centre de Formation Judiciaire de Ouagadougou pour 24 agents opérationnels du système SIGEP. Au programme : gestion des alertes GPS, procédures de révocation, droits des bénéficiaires et utilisation avancée de la plateforme numérique.',
    featured: false,
    source: 'Centre de Formation Judiciaire du Burkina',
  },
  {
    id: 'a-004',
    date: '14 février 2024',
    category: 'Partenariat',
    title: 'Le Système Horon présenté au Forum africain sur la justice réparatrice d\'Abidjan',
    excerpt: 'La délégation burkinabè a présenté le Système Horon lors du 4ème Forum Africain sur la Justice Réparatrice à Abidjan. Le programme a suscité l\'intérêt de 8 pays de la région souhaitant s\'inspirer du modèle burkinabè pour déployer des programmes similaires.',
    featured: false,
    source: 'Mission diplomatique — Burkina Faso / Côte d\'Ivoire',
  },
  {
    id: 'a-005',
    date: '20 janvier 2024',
    category: 'Communiqué',
    title: 'Ouverture de 7 nouveaux sites TIG agréés à Ouagadougou',
    excerpt: 'Le Tribunal de Grande Instance de Ouagadougou a agréé 7 nouvelles structures d\'accueil pour l\'exécution des Travaux d\'Intérêt Général : 2 établissements de santé, 3 écoles primaires et 2 espaces verts municipaux. La capacité totale d\'accueil passe à 68 places simultanées.',
    featured: false,
    source: 'TGI de Ouagadougou',
  },
  {
    id: 'a-006',
    date: '4 décembre 2023',
    category: 'Rapport',
    title: 'Rapport annuel 2023 — Économie de 297 millions FCFA vs détention classique',
    excerpt: 'Le rapport annuel du programme Horon révèle que le recours au TIG avec surveillance électronique a permis d\'éviter 842 jours de détention provisoire en 2023, représentant une économie nette estimée à 297 millions de FCFA pour l\'État burkinabè. Le taux de récidive des bénéficiaires TIG est de 7,3%, contre 34% pour la détention classique.',
    featured: false,
    source: 'Direction des Affaires Pénales — MJDH',
  },
  {
    id: 'a-007',
    date: '15 novembre 2023',
    category: 'Communiqué',
    title: 'Le Système Horon fête ses 12 mois d\'opération',
    excerpt: 'Un an après le lancement opérationnel de la plateforme SIGEP, le Système Horon dresse un bilan positif : 89 dossiers traités, 97% de disponibilité du service GPS, 3 procédures de révocation instruites. La plateforme couvre désormais les 12 arrondissements de Ouagadougou.',
    featured: false,
    source: 'Direction des Systèmes d\'Information — MJDH',
  },
  {
    id: 'a-008',
    date: '3 octobre 2023',
    category: 'Événement',
    title: 'Journée portes ouvertes — Le programme TIG expliqué aux familles',
    excerpt: 'Le Ministère de la Justice a organisé une journée portes ouvertes à destination des familles de bénéficiaires. Plus de 120 familles ont participé à des ateliers de présentation du programme, du bracelet GPS et des droits des bénéficiaires. Des traducteurs en mooré et dioula étaient disponibles.',
    featured: false,
    source: 'MJDH — Direction de la Communication',
  },
];

export default function ActualitesPage() {
  const featured  = ARTICLES.find((a) => a.featured)!;
  const rest      = ARTICLES.filter((a) => !a.featured);

  const byCategory = (cat: Category) => ARTICLES.filter((a) => a.category === cat).length;

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Header */}
      <section className="bg-white border-b border-gray-100 py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            <Newspaper className="w-3.5 h-3.5" />
            Ministère de la Justice et des Droits Humains
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Actualités & Communiqués</h1>
          <p className="text-gray-500">Informations officielles sur le Programme National TIG — Système Horon</p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* Category filters */}
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-900 text-white">
            Tout ({ARTICLES.length})
          </span>
          {(['Communiqué', 'Rapport', 'Événement', 'Partenariat'] as Category[]).map((cat) => (
            <span key={cat} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${CAT_STYLES[cat]}`}>
              {cat} ({byCategory(cat)})
            </span>
          ))}
        </div>

        {/* Featured article */}
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-gray-950 to-emerald-950 px-6 py-1.5">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">À la une</span>
          </div>
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${CAT_STYLES[featured.category]}`}>
                {featured.category}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <Calendar className="w-3.5 h-3.5" />
                {featured.date}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 leading-tight">{featured.title}</h2>
            <p className="text-gray-600 leading-relaxed mb-4">{featured.excerpt}</p>
            <p className="text-xs text-gray-400 italic">Source : {featured.source}</p>
          </div>
        </div>

        {/* Article grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rest.map((article) => (
            <article key={article.id} className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-sm transition-shadow flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${CAT_STYLES[article.category]}`}>
                  {article.category}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Calendar className="w-3 h-3" />
                  {article.date}
                </span>
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-2 leading-snug flex-1">{article.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed line-clamp-3 mb-4">{article.excerpt}</p>
              <p className="text-[10px] text-gray-400 italic">Source : {article.source}</p>
            </article>
          ))}
        </div>

        {/* Archive notice */}
        <div className="bg-white rounded-2xl border border-gray-100 px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">Archives complètes</p>
            <p className="text-xs text-gray-500 mt-0.5">Tous les communiqués antérieurs sont disponibles sur le site officiel du Ministère de la Justice</p>
          </div>
          <a
            href="https://www.justice.gov.bf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 transition-colors flex-shrink-0"
          >
            justice.gov.bf <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </main>
  );
}
