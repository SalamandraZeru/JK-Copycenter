-- A etapa 03 copiou data_retention_days=30 (valor inicial) para store_settings,
-- que é a tabela lida pelo upload. A etapa 06 gravou 15 apenas na tabela legada
-- system_config. Alinha store_settings à política de 15 dias (Política de
-- Privacidade e regra de ciclo de vida do bucket R2 jk-order-files).
update public.store_settings
set value = '15'::jsonb,
    updated_at = now()
where key = 'data_retention_days'
  and value is distinct from '15'::jsonb;
