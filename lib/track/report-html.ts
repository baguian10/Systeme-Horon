// Builds a self-contained, print-ready HTML report for one day's itinerary.
// Rendered to PDF server-side (no external assets, no map tiles → deterministic).
import type { DayItinerary } from '@/lib/track/day';

export interface ReportMeta {
  personName: string;
  caseNumber: string;
  measureType?: string | null;
  judgeName?: string | null;
  generatedBy: string;
  date: string; // YYYY-MM-DD
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}
function fmtDateLong(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

// ---- SVG trajectory (equirectangular, latitude-corrected) ----
function buildSvg(day: DayItinerary): string {
  const W = 760, H = 460, PAD = 24;
  const all: [number, number][] = [];
  day.segments.forEach((s) => s.forEach((p) => all.push(p)));
  day.geofences.forEach((g) => { if (g.center) all.push(g.center); g.polygon?.forEach((p) => all.push(p)); });
  if (all.length === 0) return '<div class="nomap">Aucune trace.</div>';

  const lats = all.map((p) => p[0]);
  const lngs = all.map((p) => p[1]);
  let minLat = Math.min(...lats), maxLat = Math.max(...lats);
  let minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  // avoid zero span
  if (maxLat - minLat < 1e-4) { maxLat += 5e-5; minLat -= 5e-5; }
  if (maxLng - minLng < 1e-4) { maxLng += 5e-5; minLng -= 5e-5; }
  const cosLat = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanLng = (maxLng - minLng) * cosLat;
  const spanLat = maxLat - minLat;
  const scale = Math.min((W - 2 * PAD) / spanLng, (H - 2 * PAD) / spanLat);
  const ox = (W - spanLng * scale) / 2;
  const oy = (H - spanLat * scale) / 2;
  const x = (lng: number) => ox + (lng - minLng) * cosLat * scale;
  const y = (lat: number) => H - (oy + (lat - minLat) * scale); // flip Y

  const parts: string[] = [];
  // geofences
  day.geofences.forEach((g) => {
    const stroke = g.isExclusion ? '#dc2626' : '#2563eb';
    if (g.polygon && g.polygon.length > 2) {
      const pts = g.polygon.map((p) => `${x(p[1]).toFixed(1)},${y(p[0]).toFixed(1)}`).join(' ');
      parts.push(`<polygon points="${pts}" fill="${stroke}11" stroke="${stroke}" stroke-width="1.5" stroke-dasharray="${g.isExclusion ? '5 3' : '0'}"/>`);
    } else if (g.center && g.radiusM) {
      const r = (g.radiusM / 111320) * scale; // m → deg lat → px (approx)
      parts.push(`<circle cx="${x(g.center[1]).toFixed(1)}" cy="${y(g.center[0]).toFixed(1)}" r="${r.toFixed(1)}" fill="${stroke}11" stroke="${stroke}" stroke-width="1.5"/>`);
    }
  });
  // path segments
  day.segments.forEach((seg) => {
    if (seg.length < 2) return;
    const d = seg.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p[1]).toFixed(1)} ${y(p[0]).toFixed(1)}`).join(' ');
    parts.push(`<path d="${d}" fill="none" stroke="#7c3aed" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`);
  });
  // stops
  day.stops.forEach((s, i) => {
    parts.push(`<circle cx="${x(s.lng).toFixed(1)}" cy="${y(s.lat).toFixed(1)}" r="9" fill="#f59e0b" stroke="#fff" stroke-width="2"/>`);
    parts.push(`<text x="${x(s.lng).toFixed(1)}" y="${(y(s.lat) + 3.5).toFixed(1)}" font-size="10" font-weight="700" fill="#fff" text-anchor="middle">${i + 1}</text>`);
  });
  // start / end
  const first = day.points[0], last = day.points[day.points.length - 1];
  if (first) parts.push(`<circle cx="${x(first.lng).toFixed(1)}" cy="${y(first.lat).toFixed(1)}" r="6" fill="#059669" stroke="#fff" stroke-width="2"/>`);
  if (last) parts.push(`<circle cx="${x(last.lng).toFixed(1)}" cy="${y(last.lat).toFixed(1)}" r="6" fill="#dc2626" stroke="#fff" stroke-width="2"/>`);

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">${parts.join('')}</svg>`;
}

export function buildReportHtml(meta: ReportMeta, day: DayItinerary): string {
  const s = day.stats;
  const stopsRows = day.stops.length
    ? day.stops.map((st, i) => `<tr><td>${i + 1}</td><td>${fmtTime(st.start)} → ${fmtTime(st.end)}</td><td>${st.durationMin} min</td><td>${esc(st.address ?? `${st.lat.toFixed(5)}, ${st.lng.toFixed(5)}`)}</td></tr>`).join('')
    : '<tr><td colspan="4" class="muted">Aucun arrêt prolongé.</td></tr>';
  const eventsRows = day.events.length
    ? day.events.map((e) => `<tr><td>${fmtTime(e.t)}</td><td class="${e.isExclusion ? 'red' : 'blue'}">${e.type === 'ENTER' ? 'Entrée' : 'Sortie'}</td><td>${esc(e.zoneName)}</td></tr>`).join('')
    : '<tr><td colspan="3" class="muted">Aucun franchissement de zone.</td></tr>';

  const curfew = day.curfew;
  const curfewBlock = curfew.windows.length
    ? `<div class="curfew ${curfew.compliant ? 'ok' : 'bad'}">
         <strong>${curfew.compliant ? 'Couvre-feu respecté' : 'Couvre-feu NON respecté'}</strong>
         ${curfew.compliant ? '' : `<span> — ${curfew.outsideMin} min hors zone, ${curfew.violations.length} infraction(s)</span>`}
         <div class="muted">${curfew.windows.map((w) => `${esc(w.zoneName)} ${w.start}–${w.end}`).join(' · ')}</div>
         ${curfew.violations.length ? `<ul>${curfew.violations.map((v) => `<li>${fmtTime(v.from)} → ${fmtTime(v.to)} (${v.mins} min)</li>`).join('')}</ul>` : ''}
       </div>`
    : '';

  const now = new Date().toLocaleString('fr-FR', { timeZone: 'UTC' });

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Itinéraire ${esc(meta.caseNumber)} ${meta.date}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;margin:0;padding:32px;font-size:12px;line-height:1.45}
  h1{font-size:18px;margin:0 0 2px}
  h2{font-size:13px;margin:18px 0 6px;border-bottom:1px solid #e2e8f0;padding-bottom:3px}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:10px}
  .brand{font-weight:800;letter-spacing:.5px;color:#059669}
  .meta{margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:2px 24px;font-size:12px}
  .meta b{color:#475569;font-weight:600}
  .stats{display:flex;gap:10px;margin:10px 0}
  .stat{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px}
  .stat .v{font-size:16px;font-weight:700}
  .stat .l{font-size:10px;color:#64748b;text-transform:uppercase}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th,td{text-align:left;padding:5px 7px;border-bottom:1px solid #eef2f7}
  th{background:#f8fafc;font-size:10px;text-transform:uppercase;color:#64748b}
  .muted{color:#94a3b8}
  .red{color:#dc2626}.blue{color:#2563eb}
  .curfew{margin:8px 0;padding:8px 10px;border-radius:8px}
  .curfew.ok{background:#ecfdf5;color:#065f46}
  .curfew.bad{background:#fef2f2;color:#991b1b}
  .curfew ul{margin:4px 0 0 16px}
  .nomap{padding:40px;text-align:center;color:#94a3b8;border:1px dashed #cbd5e1;border-radius:8px}
  footer{margin-top:24px;border-top:1px solid #e2e8f0;padding-top:8px;font-size:10px;color:#94a3b8}
</style></head><body>
  <div class="head">
    <div>
      <div class="brand">SIGEP · HORON</div>
      <h1>Rapport d'itinéraire journalier</h1>
      <div class="muted">${fmtDateLong(meta.date)}</div>
    </div>
    <div style="text-align:right" class="muted">Extrait à valeur de suivi<br>Document confidentiel</div>
  </div>

  <div class="meta">
    <div><b>Personne :</b> ${esc(meta.personName)}</div>
    <div><b>Dossier :</b> ${esc(meta.caseNumber)}</div>
    <div><b>Mesure :</b> ${esc(meta.measureType ?? '—')}</div>
    <div><b>Magistrat :</b> ${esc(meta.judgeName ?? '—')}</div>
    <div><b>Première position :</b> ${s.firstSeen ? fmtTime(s.firstSeen) : '—'}</div>
    <div><b>Dernière position :</b> ${s.lastSeen ? fmtTime(s.lastSeen) : '—'}</div>
  </div>

  ${curfewBlock}

  <div class="stats">
    <div class="stat"><div class="v">${s.distanceKm} km</div><div class="l">Distance</div></div>
    <div class="stat"><div class="v">${s.maxSpeedKmh}</div><div class="l">Vitesse max (km/h)</div></div>
    <div class="stat"><div class="v">${s.activeMin} min</div><div class="l">Temps actif</div></div>
    <div class="stat"><div class="v">${s.pointCount}</div><div class="l">Points GPS</div></div>
  </div>

  <h2>Tracé du déplacement</h2>
  ${buildSvg(day)}

  <h2>Arrêts (${day.stops.length})</h2>
  <table><thead><tr><th>#</th><th>Plage horaire</th><th>Durée</th><th>Lieu</th></tr></thead><tbody>${stopsRows}</tbody></table>

  <h2>Franchissements de zones</h2>
  <table><thead><tr><th>Heure</th><th>Type</th><th>Zone</th></tr></thead><tbody>${eventsRows}</tbody></table>

  <footer>
    Généré le ${now} (UTC) par ${esc(meta.generatedBy)} · SIGEP Horon — Surveillance électronique, Burkina Faso.
    Les heures sont en heure locale (UTC+0). Ce document reflète les positions transmises par le dispositif et peut comporter des lacunes en cas de perte de signal.
  </footer>
</body></html>`;
}
