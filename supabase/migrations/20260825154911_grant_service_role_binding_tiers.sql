-- A tabela não é exposta ao navegador. A service_role é usada somente por
-- rotas server-side autenticadas para editar e recalcular as faixas.
grant select, insert, update, delete on table public.service_binding_price_tiers to service_role;
