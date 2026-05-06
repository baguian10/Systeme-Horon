import { redirect } from 'next/navigation';

// Redirect /sigep to the login page; middleware handles /sigep/dashboard/* auth
export default function SigepRootPage() {
  redirect('/sigep/login');
}
