export const siteMetadata = {
  name: 'JK Copycenter',
  title: 'JK Copycenter | Gráfica rápida e papelaria em Passos, MG',
  description: 'Serviços gráficos e papelaria com orçamento online, retirada na loja e atendimento humano em Passos, MG.',
  locale: 'pt_BR',
} as const;

export function getConfiguredPublicSiteUrl(): URL | undefined {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim()
    || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!value) return undefined;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : undefined;
  } catch {
    return undefined;
  }
}
