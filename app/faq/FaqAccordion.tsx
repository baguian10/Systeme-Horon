'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FaqItem {
  q: string;
  a: string;
}
interface FaqSection {
  title:  string;
  color:  string;
  items:  FaqItem[];
}

const SECTIONS: FaqSection[] = [
  {
    title: 'Pour les bénéficiaires',
    color: 'emerald',
    items: [
      {
        q: 'Dois-je porter le bracelet 24h/24, même la nuit ?',
        a: 'Oui, le bracelet doit être porté en permanence, y compris la nuit et lors de la douche (il est étanche IP67). Il ne peut être retiré que par un technicien SIGEP habilité, lors d\'une maintenance planifiée.',
      },
      {
        q: 'Puis-je continuer à travailler normalement ?',
        a: 'Oui, dans la grande majorité des cas. Votre zone de déplacement est fixée par le juge et couvre généralement votre lieu de travail si celui-ci est connu au moment de l\'ordonnance. Si vous changez d\'employeur ou de lieu de travail, contactez immédiatement votre agent SIGEP pour mise à jour de la géofence.',
      },
      {
        q: 'Que se passe-t-il si je dois me déplacer hors de ma zone pour une urgence médicale ?',
        a: 'Appelez votre agent de surveillance AVANT de quitter la zone (+226 25 33 06 19). En cas d\'urgence médicale avérée, une autorisation temporaire peut être accordée en quelques minutes. Conservez tous les justificatifs (ticket de caisse de pharmacie, compte-rendu médical).',
      },
      {
        q: 'Combien de temps dure le programme TIG ?',
        a: 'La durée est fixée par l\'ordonnance du tribunal et varie en fonction de la nature de l\'infraction. Elle peut aller de 30 à 240 heures de travail, à réaliser sur une période maximale de 18 mois. Votre agent SIGEP vous indiquera le calendrier détaillé lors de la pose du bracelet.',
      },
      {
        q: 'Que reçois-je à la fin du programme ?',
        a: 'Un certificat officiel de réalisation du TIG est délivré par le Tribunal de Grande Instance compétent. Ce document atteste de la bonne exécution de votre peine et peut être produit dans toute procédure ultérieure. Le casier judiciaire est mis à jour en conséquence.',
      },
      {
        q: 'Le travail sur le site TIG est-il rémunéré ?',
        a: 'Non, les Travaux d\'Intérêt Général sont par définition non rémunérés. C\'est une peine alternative à l\'emprisonnement. Cependant, vos frais de transport pour vous rendre sur le site peuvent, dans certains cas, être pris en charge sur décision du juge.',
      },
    ],
  },
  {
    title: 'Pour les familles',
    color: 'blue',
    items: [
      {
        q: 'Comment savoir si mon proche respecte ses obligations ?',
        a: 'Le Système Horon assure une surveillance continue. Si votre proche respecte ses obligations, vous n\'avez aucune notification à attendre. En cas d\'alerte grave (violation de périmètre, problème de sécurité), l\'agent SIGEP référent prend contact avec votre proche et/ou son conseil dans les 30 minutes.',
      },
      {
        q: 'Puis-je accompagner mon proche lors des prestations TIG ?',
        a: 'Non, les prestations TIG doivent être effectuées par le bénéficiaire seul. La présence de membres de la famille sur le site d\'accueil n\'est pas autorisée pendant les heures de travail, sauf accord exceptionnel du responsable du site.',
      },
      {
        q: 'Que faire si mon proche ne rentre pas à l\'heure ?',
        a: 'Si vous constatez un retard inhabituel de votre proche, contactez l\'infoline SIGEP (+226 25 33 06 19) disponible 24h/24. Les agents disposent de la position GPS en temps réel et peuvent vérifier la situation rapidement.',
      },
      {
        q: 'Le programme peut-il être suspendu pour raisons familiales ?',
        a: 'Une suspension temporaire peut être accordée par le juge référent dans des cas exceptionnels : deuil familial, maladie grave d\'un enfant, voyage professionnel impératif. La demande doit être formulée par écrit auprès du greffe du TGI compétent avec justificatifs à l\'appui.',
      },
    ],
  },
  {
    title: 'Le bracelet GPS',
    color: 'purple',
    items: [
      {
        q: 'Le bracelet est-il douloureux ou gênant ?',
        a: 'Le bracelet SIGEP-G3 est conçu pour un port prolongé. Son ajustement est contrôlé par un technicien lors de la pose pour éviter tout inconfort. Il pèse 68 grammes et est certifié pour 24 mois de port continu. Si vous ressentez une douleur ou une irritation, contactez votre agent immédiatement.',
      },
      {
        q: 'Que se passe-t-il si la batterie se décharge ?',
        a: 'Vous recevez une alerte SMS automatique lorsque la batterie descend sous 20% (environ 14h d\'autonomie restante). Si la batterie atteint 0%, le bracelet émet une alarme sonore et votre agent est immédiatement notifié. Une décharge complète est traitée comme une tentative de sabotage si elle est répétée.',
      },
      {
        q: 'Le bracelet peut-il être retiré temporairement (opération chirurgicale, etc.) ?',
        a: 'Oui, dans des cas médicaux dûment justifiés, le bracelet peut être retiré par un technicien SIGEP. Une ordonnance médicale et l\'accord du juge sont nécessaires. Un bracelet de remplacement est posé dès que l\'état de santé le permet. Le processus est géré dans un délai maximum de 12 heures ouvrables.',
      },
      {
        q: 'Le bracelet peut-il être détecté par d\'autres personnes ?',
        a: 'Le bracelet est discret mais visible pour toute personne qui le regarde de près. Il n\'émet pas de signal sonore en fonctionnement normal. Seuls les agents SIGEP habilités ont accès aux données de positionnement. Les informations sont strictement confidentielles et protégées par le secret judiciaire.',
      },
      {
        q: 'Que se passe-t-il en zone sans couverture réseau ?',
        a: 'Le bracelet stocke les données GPS en mémoire interne (jusqu\'à 72 heures) et les transmet dès la reconnexion réseau. Si vous quittez une zone couverte par Orange BF ou Telecel, votre agent en est averti automatiquement. Des zones blanches prolongées peuvent déclencher une vérification terrain.',
      },
    ],
  },
  {
    title: 'Conséquences et procédures',
    color: 'red',
    items: [
      {
        q: 'Que se passe-t-il si je ne respecte pas une obligation ?',
        a: 'Toute violation est enregistrée automatiquement dans le système. Selon la gravité : un avertissement formel peut être émis pour une première infraction mineure ; une procédure de révocation peut être engagée par l\'agent ou le juge en cas de violations répétées ou graves. La révocation entraîne la conversion de la peine en emprisonnement ferme (Art. 28 du Code Pénal).',
      },
      {
        q: 'Puis-je contester une alerte qui me semble injustifiée ?',
        a: 'Oui. Toute alerte fait l\'objet d\'une vérification par l\'agent SIGEP avant toute décision. Si vous estimez qu\'une alerte est erronée (problème technique du bracelet, erreur GPS en milieu urbain dense), signalez-le immédiatement à votre agent. Un rapport d\'anomalie peut être déposé auprès du greffe du TGI.',
      },
      {
        q: 'Puis-je demander une modification de ma zone de déplacement ?',
        a: 'Oui, une modification de géofence peut être demandée au juge référent par requête écrite motivée (nouveau lieu de travail, déménagement autorisé, suivi médical régulier). La demande est instruite dans un délai de 15 jours ouvrables. Sans réponse du juge dans ce délai, la demande est réputée accordée.',
      },
    ],
  },
];

const COLOR_MAP: Record<string, { header: string; badge: string; chevron: string }> = {
  emerald: { header: 'text-emerald-700', badge: 'bg-emerald-600', chevron: 'text-emerald-600' },
  blue:    { header: 'text-blue-700',    badge: 'bg-blue-600',    chevron: 'text-blue-600' },
  purple:  { header: 'text-purple-700',  badge: 'bg-purple-600',  chevron: 'text-purple-600' },
  red:     { header: 'text-red-700',     badge: 'bg-red-600',     chevron: 'text-red-600' },
};

export default function FaqAccordion() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      {SECTIONS.map((section) => {
        const c = COLOR_MAP[section.color];
        return (
          <div key={section.title}>
            <div className="flex items-center gap-3 mb-4">
              <span className={`w-2 h-6 rounded-full ${c.badge}`} />
              <h2 className={`text-lg font-bold ${c.header}`}>{section.title}</h2>
            </div>
            <div className="space-y-2">
              {section.items.map((item) => {
                const key = `${section.title}::${item.q}`;
                const isOpen = open === key;
                return (
                  <div key={key} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <button
                      className="w-full px-5 py-4 flex items-start justify-between gap-4 text-left hover:bg-gray-50 transition-colors"
                      onClick={() => setOpen(isOpen ? null : key)}
                    >
                      <span className="text-sm font-semibold text-gray-900 leading-snug">{item.q}</span>
                      {isOpen
                        ? <ChevronUp className={`w-4 h-4 flex-shrink-0 mt-0.5 ${c.chevron}`} />
                        : <ChevronDown className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />}
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 border-t border-gray-50">
                        <p className="text-sm text-gray-600 leading-relaxed pt-4">{item.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
