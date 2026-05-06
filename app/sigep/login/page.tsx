'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, Lock, Eye, EyeOff, AlertCircle, Info } from 'lucide-react';
import { createClient, IS_DEMO_MODE } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/sigep/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDemoAccess() {
    router.push('/sigep/dashboard');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (IS_DEMO_MODE) {
      router.push(next);
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      if (!supabase) { router.push(next); return; }

      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError('Identifiants invalides. Vérifiez votre email et mot de passe.');
        return;
      }
      router.push(next);
      router.refresh();
    });
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
      {IS_DEMO_MODE && (
        <div className="w-full max-w-md mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-300">
            <strong>Mode démo actif.</strong> Aucune base de données configurée —
            données fictives uniquement.
          </p>
        </div>
      )}

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-5">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">SIGEP</h1>
          <p className="text-sm text-gray-400">
            Système d'Information de Gestion des Établissements Pénitentiaires
          </p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-400">Connexion sécurisée</span>
          </div>

          {error && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-5">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {IS_DEMO_MODE ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-400 text-center">
                Cliquez ci-dessous pour accéder au tableau de bord de démonstration.
              </p>
              <button
                onClick={handleDemoAccess}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
              >
                Accéder au mode démo
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Adresse email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="agent@justice.ml"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 pr-11 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors mt-2"
              >
                {isPending ? 'Connexion...' : 'Se connecter'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Accès strictement réservé au personnel autorisé.
          <br />
          Toutes les connexions sont journalisées.
        </p>
      </div>
    </div>
  );
}
