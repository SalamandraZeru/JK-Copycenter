import { redirect } from 'next/navigation';

// Não mantemos uma política de cookies separada: o uso de cookies e
// armazenamento local está descrito, por finalidade, dentro do Aviso de
// Privacidade. Redirecionamos para evitar links quebrados.
export default function CookiesPage() {
  redirect('/privacidade');
}
