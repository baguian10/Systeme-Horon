'use server';

type ContactState = { error?: string; success?: boolean; ref?: string } | null;

export async function sendContactAction(
  _: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const name    = (formData.get('name') as string)?.trim();
  const email   = (formData.get('email') as string)?.trim();
  const subject = formData.get('subject') as string;
  const message = (formData.get('message') as string)?.trim();
  const consent = formData.get('consent');

  if (!name || !email || !subject || !message) {
    return { error: 'Veuillez remplir tous les champs obligatoires.' };
  }
  if (!consent) {
    return { error: 'Vous devez accepter la politique de confidentialité pour envoyer votre message.' };
  }
  if (!email.includes('@')) {
    return { error: 'Adresse email invalide.' };
  }

  // Demo mode: simulate sending
  const ref = `CONT-${Date.now().toString().slice(-8)}`;

  // In production: send email via nodemailer / Resend / Supabase Edge Function
  // await sendEmail({ to: 'sigep@justice.gov.bf', from: email, subject, body: message });

  return { success: true, ref };
}
