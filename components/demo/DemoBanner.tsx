import { FlaskConical } from 'lucide-react';
import { IS_DEMO_MODE } from '@/lib/demo-mode';

// Permanent, site-wide banner making it unmistakable that this deployment is a
// demonstration environment with fabricated data — shown to authorities.
//
// Self-gating: renders nothing unless the deployment runs without a Supabase
// backend. The demo project (sigep-presentation) has no Supabase environment
// variables, the real site (systeme-horon) has them — so the same code base
// produces both, and no deployment can accidentally ship the wrong identity.
export default function DemoBanner() {
  if (!IS_DEMO_MODE) return null;
  return (
    <div className="w-full bg-amber-500 text-amber-950 text-center text-xs sm:text-sm font-semibold px-3 py-1.5 flex items-center justify-center gap-2 z-[2000]">
      <FlaskConical className="w-3.5 h-3.5 flex-shrink-0" />
      <span>
        Environnement de <strong>DÉMONSTRATION</strong> — données fictives, à des fins de présentation.
      </span>
    </div>
  );
}
