// Scellé des positions — chaîne d'empreintes.
//
// Chaque relevé porte l'empreinte du précédent. Retoucher, supprimer ou
// intercaler une position casse la chaîne à partir de ce point : la rupture
// devient visible, alors qu'aujourd'hui elle ne le serait pas.
//
// À ne pas confondre avec une signature : quelqu'un qui maîtrise la base peut
// recalculer toute la suite. C'est un scellé, pas un coffre — il rend la
// retouche coûteuse et détectable, ce qui suffit à opposer le journal à une
// contestation ordinaire.

import { createHash } from 'node:crypto';

export interface SealInput {
  deviceId: string;
  recordedAt: string;
  lat: number;
  lng: number;
  prev: string | null;
}

// Les coordonnées sont figées à six décimales (~11 cm) : la base pourrait
// restituer un flottant différemment d'une lecture à l'autre, et une empreinte
// qui dépend du formatage n'est pas vérifiable.
export function sealHash({ deviceId, recordedAt, lat, lng, prev }: SealInput): string {
  const payload = [
    deviceId,
    new Date(recordedAt).toISOString(),
    lat.toFixed(6),
    lng.toFixed(6),
    prev ?? 'GENESE',
  ].join('|');
  return createHash('sha256').update(payload).digest('hex');
}

export interface SealedRow {
  id?: string;
  device_id: string;
  recorded_at: string;
  latitude: number;
  longitude: number;
  seal_seq: number | null;
  seal_prev: string | null;
  seal_hash: string | null;
}

export interface ChainVerdict {
  checked: number;
  sealed: number;
  /** Vrai quand tout ce qui est scellé s'enchaîne correctement. */
  intact: boolean;
  /** Première rupture rencontrée, dans l'ordre de la chaîne. */
  brokenAt: { seq: number | null; recordedAt: string; reason: string } | null;
}

// Vérifie une suite de relevés d'un même bracelet, donnée dans l'ordre de la
// chaîne. Les lignes antérieures au scellé (colonnes vides) sont comptées mais
// n'invalident rien : elles précèdent la mise en place du dispositif, et le dire
// vaut mieux que de déclarer une rupture qui n'en est pas une.
export function verifyChain(rows: SealedRow[]): ChainVerdict {
  let sealed = 0;
  let prevHash: string | null = null;
  let brokenAt: ChainVerdict['brokenAt'] = null;

  for (const r of rows) {
    if (!r.seal_hash) continue; // relevé antérieur au scellé
    sealed++;

    if (prevHash !== null && r.seal_prev !== prevHash) {
      brokenAt ??= { seq: r.seal_seq, recordedAt: r.recorded_at, reason: 'chaînon manquant ou position supprimée' };
      prevHash = r.seal_hash;
      continue;
    }

    const expected = sealHash({
      deviceId: r.device_id,
      recordedAt: r.recorded_at,
      lat: r.latitude,
      lng: r.longitude,
      prev: r.seal_prev,
    });
    if (expected !== r.seal_hash) {
      brokenAt ??= { seq: r.seal_seq, recordedAt: r.recorded_at, reason: 'relevé modifié après enregistrement' };
    }
    prevHash = r.seal_hash;
  }

  return { checked: rows.length, sealed, intact: brokenAt === null, brokenAt };
}
