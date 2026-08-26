-- Categorias passam a agrupar somente produtos de papelaria.
-- Serviços gráficos não participam mais dessa navegação nem mantêm vínculo legado.
update public.services
set category_id = null
where category_id is not null;
