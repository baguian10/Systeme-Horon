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
# Two things must NOT leak from the real deployment into the demo, hence the
# explicit config below:
#   • the cron jobs declared in vercel.json  → vercel.demo.json omits them
#   • the local .env.local                   → gitignored, never uploaded
#
# Usage:  bash scripts/deploy-demo.sh
set -euo pipefail

export VERCEL_ORG_ID="team_Iuawym7NBAt0rmt8aw7nuBf8"
export VERCEL_PROJECT_ID="prj_s2PtSv0lui48aQoxIHCUN3bGgDAI"   # sigep-presentation

cd "$(dirname "$0")/.."

echo "→ Déploiement de la démonstration (projet sigep-presentation)…"
vercel --prod --yes --local-config vercel.demo.json

echo
echo "→ Vérifications :"
for path in "/" "/sigep/dashboard/tig-sites" "/sigep/dashboard/cases/c-0001"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://sigep-presentation.vercel.app${path}")
  printf '   %-40s HTTP %s\n' "$path" "$code"
done

home=$(curl -s https://sigep-presentation.vercel.app/)
echo "$home" | grep -q "Environnement de" \
  && echo "   bandeau DÉMONSTRATION                    présent" \
  || echo "   bandeau DÉMONSTRATION                    ABSENT — vérifier que le projet n'a pas de variables Supabase"

curl -s https://sigep-presentation.vercel.app/sigep/dashboard/cases/c-0001 | grep -q "Suivi TIG" \
  && echo "   panneau Suivi TIG                        présent" \
  || echo "   panneau Suivi TIG                        ABSENT"
