import Link from "next/link";
import { ShieldCheck, Lock, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "SIGEP — Accès restreint",
  robots: "noindex, nofollow",
};

export default function SigepPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mb-8">
          <Lock className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">SIGEP</h1>
        <p className="text-gray-400 mb-2">
          Système d'Information de Gestion des Établissements Pénitentiaires
        </p>
        <p className="text-sm text-gray-500 mb-10">
          Accès réservé au personnel judiciaire et pénitentiaire autorisé.
        </p>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-8">
          <div className="flex items-center gap-2 justify-center text-blue-400 mb-6">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-sm font-medium">Connexion sécurisée requise</span>
          </div>
          <p className="text-sm text-gray-500 text-center">
            Le portail d'authentification SIGEP sera déployé dans cette section.
            Seul le personnel avec des identifiants valides pourra accéder au tableau de bord.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au site public
        </Link>
      </div>
    </div>
  );
}
