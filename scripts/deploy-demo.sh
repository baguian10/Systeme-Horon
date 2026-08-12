#!/usr/bin/env bash
# Deploy the public demonstration (sigep-presentation.vercel.app) from THIS repo.
#
# There is one code base. The two deployments differ only by environment:
#   • systeme-horon      → carries the Supabase variables → real site
#   • sigep-presentation → carries no variables           → demo mode
#
# `lib/demo-mode.ts` reads that difference and turns on the amber "DÉMONSTRATION"
# banner, the demo homepage block and the demo page titles. Nothing to toggle by
# hand, and no separate fork to keep in sync.
#
# The one thing that must not follow the code onto the demo is the pair of cron
# jobs declared in vercel.json: they poll the tracker fleet and send measure
# reminders, which is meaningless on an instance with no backend.
#
# `vercel --local-config` does NOT help here — it only changes which file the
# CLI reads locally, while the build still picks up the vercel.json sitting at
# the root of the uploaded sources. So the file is physically swapped for the
# duration of the deploy, and restored by an EXIT trap even on failure or Ctrl-C.
#
# Usage:  bash scripts/deploy-demo.sh
set -euo pipefail

export VERCEL_ORG_ID="team_Iuawym7NBAt0rmt8aw7nuBf8"
export VERCEL_PROJECT_ID="prj_s2PtSv0lui48aQoxIHCUN3bGgDAI"   # sigep-presentation

cd "$(dirname "$0")/.."

restore() {
  if [ -f vercel.json.real ]; then
    mv -f vercel.json.real vercel.json
    echo "   vercel.json restauré (avec les crons)"
  fi
}
trap restore EXIT

echo "→ Substitution de vercel.json par vercel.demo.json (sans crons)…"
cp -f vercel.json vercel.json.real
cp -f vercel.demo.json vercel.json

echo "→ Déploiement de la démonstration (projet sigep-presentation)…"
vercel --prod --yes

restore
trap - EXIT

echo
echo "→ Vérifications :"
for path in "/" "/sigep/dashboard/tig-sites" "/sigep/dashboard/cases/c-0001"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://sigep-presentation.vercel.app${path}")
  printf '   %-40s HTTP %s\n' "$path" "$code"
done

curl -s https://sigep-presentation.vercel.app/ | grep -q "Environnement de" \
  && echo "   bandeau DÉMONSTRATION                    présent" \
  || echo "   bandeau DÉMONSTRATION                    ABSENT — le projet a-t-il reçu des variables Supabase ?"

curl -s https://sigep-presentation.vercel.app/sigep/dashboard/cases/c-0001 | grep -q "Suivi TIG" \
  && echo "   panneau Suivi TIG                        présent" \
  || echo "   panneau Suivi TIG                        ABSENT"
