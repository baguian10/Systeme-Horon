// IMEI validation shared by the registration form and the create API.
// A valid IMEI is exactly 15 digits and passes the Luhn checksum (the 15th
// digit confirms the first 14), which catches typos and mis-copied numbers.

export function normalizeImei(raw: string): string {
  return (raw ?? '').replace(/[\s-]/g, '');
}

export function isValidImei(raw: string): boolean {
  const s = normalizeImei(raw);
  if (!/^\d{15}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = s.charCodeAt(i) - 48;
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}
