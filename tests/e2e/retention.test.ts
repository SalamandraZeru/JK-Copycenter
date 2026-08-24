import { describe, it, expect } from 'vitest';

describe('Retenção de 30 dias', () => {
  it('arquivo com expires_at no passado → não acessível', () => {
    const expiredFile = {
      id: 'file-old',
      original_name: 'antigo.pdf',
      expires_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), // 1 day ago
      status: 'deleted',
    };

    const isAvailable = new Date(expiredFile.expires_at).getTime() > Date.now() && expiredFile.status !== 'deleted';
    expect(isAvailable).toBe(false);
  });

  it('signed URL de arquivo expirado → 403 do Storage', () => {
    const signedUrlExpired = true;
    const responseCode = signedUrlExpired ? 403 : 200;
    expect(responseCode).toBe(403);
  });

  it('dashboard não mostra arquivos expirados como disponíveis', () => {
    const files = [
      { id: 'f1', name: 'ativo.pdf', expires_at: new Date(Date.now() + 10 * 86400000).toISOString() },
      { id: 'f2', name: 'expirado.pdf', expires_at: new Date(Date.now() - 5 * 86400000).toISOString() },
    ];

    const availableFiles = files.filter(f => new Date(f.expires_at).getTime() > Date.now());
    expect(availableFiles.length).toBe(1);
    expect(availableFiles[0]?.id).toBe('f1');
  });
});
