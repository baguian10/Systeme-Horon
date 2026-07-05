import { redirect } from 'next/navigation';

// Redirect /sigep to the login page; the proxy handles /sigep/dashboard/* auth
export default function SigepRootPage() {
  redirect('/sigep/login');
}
