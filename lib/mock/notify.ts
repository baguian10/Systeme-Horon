import { MOCK_THREADS, MOCK_MESSAGES } from './data';

// Équivalent, pour la démonstration, de la notification push envoyée au juge
// lorsque les heures de TIG ordonnées sont atteintes.
//
// En mode réel, `addTigAttendanceAction` appelle `sendPushToUser`. Une
// démonstration n'a ni base de données ni abonnement push : la notification
// n'arriverait nulle part, et la fonctionnalité que le dossier gouvernemental
// présente comme centrale resterait invisible pour qui teste la plateforme.
// Elle est donc déposée dans la messagerie interne, où le badge « non lu » de la
// barre latérale la signale immédiatement.
//
// L'expéditeur est un émetteur système distinct des comptes simulés, et non le
// compte d'administration : un message n'est jamais « non lu » pour son propre
// auteur, or la démonstration s'ouvre justement sur le compte d'administration.
// Avec un émetteur à part, le badge s'allume pour tous les destinataires, quel
// que soit le rôle depuis lequel le visiteur explore la plateforme.
//
// Le fil porte un identifiant déterministe dérivé du dossier, qui joue le rôle
// du `tag` de la push : si le visiteur supprime puis ressaisit le pointage qui
// franchit le seuil, le message est mis à jour au lieu d'être dupliqué.
const SYSTEM_SENDER_ID = 'u-system';

export function notifyJudgeTigCompleteDemo(params: {
  caseId: string;
  caseNumber: string;
  individualName: string;
  judgeId: string;
  actorId: string;
  totalHours: number;
  orderedHours: number;
}): void {
  const { caseId, caseNumber, individualName, judgeId, actorId, totalHours, orderedHours } = params;

  const threadId = `th-tig-${caseId}`;
  const now = new Date().toISOString();
  const content =
    `Notification automatique du SIGEP — les heures de travail d'intérêt général ordonnées sont accomplies. ` +
    `${individualName} (dossier ${caseNumber}) totalise ${totalHours} h sur les ${orderedHours} h ordonnées, ` +
    `cumul recalculé à partir des séances pointées et signées sur le site agréé. ` +
    `Le magistrat est invité à constater l'exécution de la peine et à statuer.`;
  const preview = `TIG accompli — ${totalHours} h / ${orderedHours} h. Action requise.`;

  // Le juge est le destinataire ; l'agent qui a pointé et l'administration
  // suivent le dossier. Tous doivent voir le fil apparaître dans leur messagerie.
  const participants = Array.from(new Set([judgeId, actorId, 'u-0001']));

  const existing = MOCK_THREADS.find((t) => t.id === threadId);
  if (existing) {
    existing.last_message_at = now;
    existing.last_message_preview = preview;
    existing.participant_ids = participants;
  } else {
    MOCK_THREADS.push({
      id: threadId,
      case_id: caseId,
      case_number: caseNumber,
      subject: `TIG accompli — ${individualName}`,
      participant_ids: participants,
      last_message_at: now,
      last_message_preview: preview,
      created_by: SYSTEM_SENDER_ID,
      created_at: now,
    });
  }

  const messageId = `msg-tig-${caseId}`;
  const previousMessage = MOCK_MESSAGES.find((m) => m.id === messageId);
  if (previousMessage) {
    previousMessage.content = content;
    previousMessage.created_at = now;
    // Le seuil est franchi à nouveau : tous les destinataires doivent le revoir.
    previousMessage.is_read_by = [];
    return;
  }
  MOCK_MESSAGES.push({
    id: messageId,
    thread_id: threadId,
    sender_id: SYSTEM_SENDER_ID,
    sender_name: 'SIGEP — Notification automatique',
    sender_role: 'SUPER_ADMIN',
    content,
    // Lu par personne : c'est ce qui allume le badge de la barre latérale.
    is_read_by: [],
    created_at: now,
  });
}
