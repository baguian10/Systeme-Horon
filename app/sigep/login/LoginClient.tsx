'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck, Lock, Eye, EyeOff, AlertCircle,
  Info, KeyRound, ArrowLeft,
} from 'lucide-react';
import { createClient, IS_DEMO_MODE } from '@/lib/supabase/client';

type Step = 'credentials' | 'mfa';
type MfaEnroll = { factorId: string; qr: string; secret: string };

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/sigep/dashboard';

  const [step, setStep]         = useState<Step>('credentials');
  const [mfaEnroll, setMfaEnroll] = useState<MfaEnroll | null>(null);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode]   = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (IS_DEMO_MODE) {
      setStep('mfa');
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
      // Enforce TOTP 2FA. Accounts without a verified factor start enrollment
      // now (QR shown at the next step) — they can no longer bypass the second
      // factor by simply not having one enrolled.
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = factors?.totp?.find((f) => f.status === 'verified');
      if (!verified) {
        for (const f of factors?.totp ?? []) {
          if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
        const { data: enroll, error: enrollErr } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
        if (enrollErr || !enroll) {
          setError("Impossible d'initialiser la double authentification.");
          return;
        }
        setMfaEnroll({ factorId: enroll.id, qr: enroll.totp.qr_code, secret: enroll.totp.secret });
      }
      setStep('mfa');
    });
  }

  function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (IS_DEMO_MODE) {
      if (otpCode.length < 6) {
        setError('Veuillez saisir un code à 6 chiffres.');
        return;
      }
      router.push(next);
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      if (!supabase) { router.push(next); return; }
      // Verifying the code activates the factor when enrolling, or satisfies
      // the challenge for an existing verified factor.
      let factorId = mfaEnroll?.factorId;
      if (!factorId) {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        factorId = factors?.totp?.find((f) => f.status === 'verified')?.id;
      }
      if (!factorId) { setError('Aucun facteur de vérification disponible.'); return; }
      const { data: challenge } = await supabase.auth.mfa.challenge({ factorId });
      if (!challenge) { setError("Impossible d'initier la vérification MFA."); return; }
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: otpCode,
      });
      if (verifyErr) {
        setError('Code de vérification invalide ou expiré.');
        return;
      }
      router.push(next);
      router.refresh();
    });
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">

      {IS_DEMO_MODE && (
        <div className="w-full max-w-md mb-4 bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-300">
            <strong>Mode démo actif.</strong> Entrez n&apos;importe quels identifiants et un code à 6 chiffres pour accéder au tableau de bord.
          </p>
        </div>
      )}

      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-900/50 mb-5">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white">SIGEP</h1>
            <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full uppercase tracking-widest">
              Restreint
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Système d&apos;Information de Gestion — Surveillance Électronique
          </p>
          <p className="text-[10px] text-slate-600 mt-1 uppercase tracking-widest">
            Ministère de la Justice · Burkina Faso
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden shadow-2xl">

          <div className="flex border-b border-slate-700/60">
            {(['credentials', 'mfa'] as Step[]).map((s, i) => (
              <div
                key={s}
                className={`flex-1 py-3 text-center text-xs font-semibold transition-colors ${
                  step === s
                    ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-400/5'
                    : 'text-slate-600'
                }`}
              >
                {i + 1}. {s === 'credentials' ? 'Identifiants' : 'Vérification 2FA'}
              </div>
            ))}
          </div>

          <div className="p-8">
            {error && (
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/25 rounded-xl p-3 mb-5">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {step === 'credentials' && (
              <form onSubmit={handleCredentials} className="space-y-4">
                <div className="flex items-center gap-2 mb-5">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-400">Connexion sécurisée</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                    Adresse email institutionnelle
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required={!IS_DEMO_MODE}
                    autoComplete="email"
                    placeholder="agent@justice.gov.bf"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required={!IS_DEMO_MODE}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 pr-11 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors mt-2 shadow-lg shadow-emerald-900/40"
                >
                  {isPending ? 'Vérification...' : 'Continuer →'}
                </button>
              </form>
            )}

            {step === 'mfa' && (
              <form onSubmit={handleMfa} className="space-y-5">
                <div className="flex items-center gap-2 mb-2">
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-400">Vérification en deux étapes</span>
                </div>
                {mfaEnroll ? (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Première connexion : configurez la double authentification. Scannez ce QR code avec une application d&apos;authentification (Google Authenticator, Authy…), puis saisissez le code à 6 chiffres généré.
                    </p>
                    <div className="flex justify-center bg-white rounded-xl p-3">
                      {/* Supabase returns the TOTP QR as an SVG data URI */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mfaEnroll.qr} alt="QR code TOTP" className="w-40 h-40" />
                    </div>
                    <p className="text-[10px] text-slate-500 text-center">
                      Clé manuelle : <span className="font-mono text-slate-300 break-all">{mfaEnroll.secret}</span>
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Saisissez le code à 6 chiffres de votre application d&apos;authentification.
                  </p>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                    Code Authenticator (6 chiffres)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    placeholder="_ _ _ _ _ _"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-2xl tracking-[0.5em] text-center font-mono"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setStep('credentials'); setOtpCode(''); setError(null); setMfaEnroll(null); }}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-slate-700 text-slate-400 text-sm hover:bg-slate-800 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Retour
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || otpCode.length < 6}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors shadow-lg shadow-emerald-900/40"
                  >
                    {isPending ? 'Vérification...' : 'Accéder au système'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="mt-5 bg-slate-900/60 border border-slate-800 rounded-xl px-5 py-4 space-y-1.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Système à accès fermé</p>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Aucune création de compte autonome. L&apos;accès est accordé exclusivement sur invitation du Super Administrateur. Toutes les tentatives de connexion sont journalisées et auditées.
          </p>
        </div>

        <p className="text-center text-[10px] text-slate-700 mt-4 uppercase tracking-widest">
          Accès strictement réservé au personnel judiciaire habilité
        </p>
      </div>
    </div>
  );
}
