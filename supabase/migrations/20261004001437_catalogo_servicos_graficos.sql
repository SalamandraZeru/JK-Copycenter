-- Catálogo de serviços gráficos (orçamento manual): novos serviços e árvores de compatibilidade completas.
-- Opções escolhidas por pesquisa de mercado de gráficas rápidas; a equipe pode editar tudo no admin.

create function pg_temp.sid(p_slug text) returns uuid language sql stable as $$
  select id from public.services where slug = p_slug and deleted_at is null
$$;
create function pg_temp.fid(p_slug text, p_key text) returns uuid language sql stable as $$
  select f.id from public.service_fields f join public.services s on s.id = f.service_id
  where s.slug = p_slug and s.deleted_at is null and f.key = p_key
$$;

create temporary table paths (slug text, target_key text, target_value text, conditions text) on commit drop;

-- O slug "encadernacao" pertencia a um serviço já excluído; libera o endereço para o serviço novo.
update public.services set slug = 'encadernacao-excluido-2026-08' where slug = 'encadernacao' and deleted_at is not null;

-- Serviços publicados ficam travados para edição: volta a rascunho durante a migração.
update public.services set catalog_state = 'draft', is_active = false where slug in ('impressao', 'cartoes-de-visita', 'plotagem') and deleted_at is null;

-- impressao
update public.services set pricing_profile_config = pricing_profile_config || '{"require_complete_compatibility":true}'::jsonb where slug = 'impressao';
delete from public.service_field_option_dependencies where service_id = pg_temp.sid('impressao');
update public.service_fields set sort_order = 4 where id = pg_temp.fid('impressao', 'tipo_de_papel');
update public.service_fields set sort_order = 5 where id = pg_temp.fid('impressao', 'gramatura');
update public.service_fields set sort_order = 6 where id = pg_temp.fid('impressao', 'frente_e_verso_livreto');
insert into pg_temp.paths values
('impressao','tipo_de_papel','opcao_1','tamanho_do_papel=opcao_1'),
('impressao','tipo_de_papel','opcao_2','tamanho_do_papel=opcao_1'),
('impressao','tipo_de_papel','opcao_3','tamanho_do_papel=opcao_1'),
('impressao','tipo_de_papel','opcao_4','tamanho_do_papel=opcao_1'),
('impressao','tipo_de_papel','opcao_5','tamanho_do_papel=opcao_1'),
('impressao','tipo_de_papel','opcao_6','tamanho_do_papel=opcao_1'),
('impressao','frente_e_verso_livreto','opcao_1','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_1'),
('impressao','frente_e_verso_livreto','opcao_2','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_1'),
('impressao','gramatura','opcao_1','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_1'),
('impressao','gramatura','opcao_3','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_1'),
('impressao','gramatura','opcao_5','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_1'),
('impressao','frente_e_verso_livreto','opcao_1','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_2'),
('impressao','frente_e_verso_livreto','opcao_2','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_2'),
('impressao','gramatura','opcao_3','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_2'),
('impressao','gramatura','opcao_4','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_2'),
('impressao','gramatura','opcao_5','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_2'),
('impressao','gramatura','opcao_6','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_2'),
('impressao','gramatura','opcao_7','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_2'),
('impressao','gramatura','opcao_9','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_2'),
('impressao','frente_e_verso_livreto','opcao_1','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_3'),
('impressao','frente_e_verso_livreto','opcao_2','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_3'),
('impressao','gramatura','opcao_5','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_3'),
('impressao','gramatura','opcao_7','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_3'),
('impressao','frente_e_verso_livreto','opcao_1','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_4'),
('impressao','frente_e_verso_livreto','opcao_2','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_4'),
('impressao','gramatura','opcao_7','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_4'),
('impressao','gramatura','opcao_9','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_4'),
('impressao','frente_e_verso_livreto','opcao_1','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_5'),
('impressao','gramatura','opcao_5','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_5'),
('impressao','gramatura','opcao_7','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_5'),
('impressao','frente_e_verso_livreto','opcao_1','tamanho_do_papel=opcao_1;tipo_de_papel=opcao_6'),
('impressao','tipo_de_papel','opcao_1','tamanho_do_papel=opcao_2'),
('impressao','tipo_de_papel','opcao_2','tamanho_do_papel=opcao_2'),
('impressao','tipo_de_papel','opcao_3','tamanho_do_papel=opcao_2'),
('impressao','tipo_de_papel','opcao_4','tamanho_do_papel=opcao_2'),
('impressao','tipo_de_papel','opcao_5','tamanho_do_papel=opcao_2'),
('impressao','tipo_de_papel','opcao_6','tamanho_do_papel=opcao_2'),
('impressao','frente_e_verso_livreto','opcao_1','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_1'),
('impressao','frente_e_verso_livreto','opcao_2','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_1'),
('impressao','gramatura','opcao_1','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_1'),
('impressao','gramatura','opcao_3','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_1'),
('impressao','gramatura','opcao_5','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_1'),
('impressao','frente_e_verso_livreto','opcao_1','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_2'),
('impressao','frente_e_verso_livreto','opcao_2','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_2'),
('impressao','gramatura','opcao_3','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_2'),
('impressao','gramatura','opcao_4','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_2'),
('impressao','gramatura','opcao_5','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_2'),
('impressao','gramatura','opcao_6','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_2'),
('impressao','gramatura','opcao_7','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_2'),
('impressao','gramatura','opcao_9','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_2'),
('impressao','frente_e_verso_livreto','opcao_1','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_3'),
('impressao','frente_e_verso_livreto','opcao_2','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_3'),
('impressao','gramatura','opcao_5','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_3'),
('impressao','gramatura','opcao_7','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_3'),
('impressao','frente_e_verso_livreto','opcao_1','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_4'),
('impressao','frente_e_verso_livreto','opcao_2','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_4'),
('impressao','gramatura','opcao_7','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_4'),
('impressao','gramatura','opcao_9','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_4'),
('impressao','frente_e_verso_livreto','opcao_1','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_5'),
('impressao','gramatura','opcao_5','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_5'),
('impressao','gramatura','opcao_7','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_5'),
('impressao','frente_e_verso_livreto','opcao_1','tamanho_do_papel=opcao_2;tipo_de_papel=opcao_6'),
('impressao','tipo_de_papel','opcao_1','tamanho_do_papel=opcao_3'),
('impressao','tipo_de_papel','opcao_2','tamanho_do_papel=opcao_3'),
('impressao','tipo_de_papel','opcao_4','tamanho_do_papel=opcao_3'),
('impressao','tipo_de_papel','opcao_5','tamanho_do_papel=opcao_3'),
('impressao','tipo_de_papel','opcao_6','tamanho_do_papel=opcao_3'),
('impressao','frente_e_verso_livreto','opcao_1','tamanho_do_papel=opcao_3;tipo_de_papel=opcao_1'),
('impressao','frente_e_verso_livreto','opcao_2','tamanho_do_papel=opcao_3;tipo_de_papel=opcao_1'),
('impressao','gramatura','opcao_1','tamanho_do_papel=opcao_3;tipo_de_papel=opcao_1'),
('impressao','gramatura','opcao_3','tamanho_do_papel=opcao_3;tipo_de_papel=opcao_1'),
('impressao','gramatura','opcao_5','tamanho_do_papel=opcao_3;tipo_de_papel=opcao_1'),
('impressao','frente_e_verso_livreto','opcao_1','tamanho_do_papel=opcao_3;tipo_de_papel=opcao_2'),
('impressao','frente_e_verso_livreto','opcao_2','tamanho_do_papel=opcao_3;tipo_de_papel=opcao_2'),
('impressao','gramatura','opcao_3','tamanho_do_papel=opcao_3;tipo_de_papel=opcao_2'),
('impressao','gramatura','opcao_4','tamanho_do_papel=opcao_3;tipo_de_papel=opcao_2'),
('impressao','gramatura','opcao_5','tamanho_do_papel=opcao_3;tipo_de_papel=opcao_2'),
('impressao','gramatura','opcao_6','tamanho_do_papel=opcao_3;tipo_de_papel=opcao_2'),
('impressao','gramatura','opcao_7','tamanho_do_papel=opcao_3;tipo_de_papel=opcao_2'),
('impressao','gramatura','opcao_9','tamanho_do_papel=opcao_3;tipo_de_papel=opcao_2'),
('impressao','frente_e_verso_livreto','opcao_1','tamanho_do_papel=opcao_3;tipo_de_papel=opcao_4'),
('impressao','frente_e_verso_livreto','opcao_2','tamanho_do_papel=opcao_3;tipo_de_papel=opcao_4'),
('impressao','gramatura','opcao_7','tamanho_do_papel=opcao_3;tipo_de_papel=opcao_4'),
('impressao','gramatura','opcao_9','tamanho_do_papel=opcao_3;tipo_de_papel=opcao_4'),
('impressao','frente_e_verso_livreto','opcao_1','tamanho_do_papel=opcao_3;tipo_de_papel=opcao_5'),
('impressao','gramatura','opcao_5','tamanho_do_papel=opcao_3;tipo_de_papel=opcao_5'),
('impressao','gramatura','opcao_7','tamanho_do_papel=opcao_3;tipo_de_papel=opcao_5'),
('impressao','frente_e_verso_livreto','opcao_1','tamanho_do_papel=opcao_3;tipo_de_papel=opcao_6'),
('impressao','tipo_de_papel','opcao_2','tamanho_do_papel=opcao_4'),
('impressao','tipo_de_papel','opcao_4','tamanho_do_papel=opcao_4'),
('impressao','tipo_de_papel','opcao_6','tamanho_do_papel=opcao_4'),
('impressao','frente_e_verso_livreto','opcao_1','tamanho_do_papel=opcao_4;tipo_de_papel=opcao_2'),
('impressao','frente_e_verso_livreto','opcao_2','tamanho_do_papel=opcao_4;tipo_de_papel=opcao_2'),
('impressao','gramatura','opcao_4','tamanho_do_papel=opcao_4;tipo_de_papel=opcao_2'),
('impressao','gramatura','opcao_5','tamanho_do_papel=opcao_4;tipo_de_papel=opcao_2'),
('impressao','gramatura','opcao_6','tamanho_do_papel=opcao_4;tipo_de_papel=opcao_2'),
('impressao','gramatura','opcao_7','tamanho_do_papel=opcao_4;tipo_de_papel=opcao_2'),
('impressao','gramatura','opcao_9','tamanho_do_papel=opcao_4;tipo_de_papel=opcao_2'),
('impressao','frente_e_verso_livreto','opcao_1','tamanho_do_papel=opcao_4;tipo_de_papel=opcao_4'),
('impressao','frente_e_verso_livreto','opcao_2','tamanho_do_papel=opcao_4;tipo_de_papel=opcao_4'),
('impressao','gramatura','opcao_7','tamanho_do_papel=opcao_4;tipo_de_papel=opcao_4'),
('impressao','gramatura','opcao_9','tamanho_do_papel=opcao_4;tipo_de_papel=opcao_4'),
('impressao','frente_e_verso_livreto','opcao_1','tamanho_do_papel=opcao_4;tipo_de_papel=opcao_6');

-- cartoes-de-visita
update public.services set pricing_profile_config = pricing_profile_config || '{"require_complete_compatibility":true}'::jsonb where slug = 'cartoes-de-visita';
delete from public.service_field_option_dependencies where service_id = pg_temp.sid('cartoes-de-visita');
update public.service_fields set sort_order = 2 where id = pg_temp.fid('cartoes-de-visita', 'frente___verso');
update public.service_fields set sort_order = 3 where id = pg_temp.fid('cartoes-de-visita', 'acabamento');
update public.service_fields set label = 'Laminação', options = (select jsonb_agg(case when o->>'value' = 'opcao_2' then jsonb_set(o, '{label}', to_jsonb('Laminação brilho'::text)) else o end) from jsonb_array_elements((select jsonb_agg(case when o->>'value' = 'opcao_1' then jsonb_set(o, '{label}', to_jsonb('Laminação fosca'::text)) else o end) from jsonb_array_elements(options) o)) o) where id = pg_temp.fid('cartoes-de-visita', 'acabamento');
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('cartoes-de-visita'), 'papel', 'Papel', 'radio'::public.field_type, '[{"label":"Couché 300g","value":"couche_300","is_active":true,"price_effect":{"type":"none"}},{"label":"Couché 250g","value":"couche_250","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 1, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('cartoes-de-visita'), 'extras', 'Extras', 'radio'::public.field_type, '[{"label":"Sem extras","value":"nenhum","is_active":true,"price_effect":{"type":"none"}},{"label":"Cantos arredondados","value":"cantos","is_active":true,"price_effect":{"type":"none"}},{"label":"Verniz localizado na frente","value":"verniz","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 4, true);
insert into pg_temp.paths values
('cartoes-de-visita','extras','nenhum','acabamento=opcao_1'),
('cartoes-de-visita','extras','cantos','acabamento=opcao_1'),
('cartoes-de-visita','extras','verniz','acabamento=opcao_1'),
('cartoes-de-visita','extras','nenhum','acabamento=opcao_2'),
('cartoes-de-visita','extras','cantos','acabamento=opcao_2');

-- plotagem
update public.services set pricing_profile_config = pricing_profile_config || '{"require_complete_compatibility":true}'::jsonb where slug = 'plotagem';
delete from public.service_field_option_dependencies where service_id = pg_temp.sid('plotagem');
update public.service_fields set options = options || '[{"label":"A0","value":"a0","is_active":true,"price_effect":{"type":"none"}}]'::jsonb where id = pg_temp.fid('plotagem', 'tamanho');
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('plotagem'), 'impressao', 'Impressão', 'radio'::public.field_type, '[{"label":"Preto e branco (linhas)","value":"pb","is_active":true,"price_effect":{"type":"none"}},{"label":"Colorido","value":"colorido","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 2, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('plotagem'), 'papel', 'Papel', 'select'::public.field_type, '[{"label":"Sulfite 75g","value":"sulfite_75","is_active":true,"price_effect":{"type":"none"}},{"label":"Sulfite 90g","value":"sulfite_90","is_active":true,"price_effect":{"type":"none"}},{"label":"Couché fosco 150g (pôster)","value":"couche_150","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 3, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('plotagem'), 'dobra', 'Entrega', 'radio'::public.field_type, '[{"label":"Enrolado (sem dobra)","value":"enrolado","is_active":true,"price_effect":{"type":"none"}},{"label":"Dobrado em A4 (padrão ABNT)","value":"dobrado_a4","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 4, true);
insert into pg_temp.paths values
('plotagem','papel','sulfite_75','impressao=pb'),
('plotagem','papel','sulfite_90','impressao=pb'),
('plotagem','papel','sulfite_75','impressao=colorido'),
('plotagem','papel','sulfite_90','impressao=colorido'),
('plotagem','papel','couche_150','impressao=colorido'),
('plotagem','dobra','enrolado','papel=sulfite_75'),
('plotagem','dobra','dobrado_a4','papel=sulfite_75'),
('plotagem','dobra','enrolado','papel=sulfite_90'),
('plotagem','dobra','dobrado_a4','papel=sulfite_90'),
('plotagem','dobra','enrolado','papel=couche_150');

-- livreto-grampo-canoa
update public.services set description = 'Livretos, revistas e cardápios grampeados no meio. Envie um PDF único com as páginas em ordem.' where slug = 'livreto-grampo-canoa';
delete from public.service_field_option_dependencies where service_id = pg_temp.sid('livreto-grampo-canoa');
update public.service_fields set field_type = 'select'::public.field_type, options = '[{"label":"A5 fechado (14,8 x 21 cm)","value":"a5","is_active":true,"price_effect":{"type":"none"}},{"label":"A4 fechado (21 x 29,7 cm)","value":"a4","is_active":true,"price_effect":{"type":"none"}},{"label":"A6 fechado (10,5 x 14,8 cm)","value":"a6","is_active":true,"price_effect":{"type":"none"}},{"label":"Quadrado 20 x 20 cm","value":"q20","is_active":true,"price_effect":{"type":"none"}}]'::jsonb where id = pg_temp.fid('livreto-grampo-canoa', 'formato_fechado');
update public.service_fields set options = '[{"label":"Preto e branco","value":"pb","is_active":true,"price_effect":{"type":"none"}},{"label":"Colorido","value":"colorido","is_active":true,"price_effect":{"type":"none"}}]'::jsonb where id = pg_temp.fid('livreto-grampo-canoa', 'cor_miolo');
update public.service_fields set options = '[{"label":"Sulfite 75g","value":"sulfite_75","is_active":true,"price_effect":{"type":"none"}},{"label":"Sulfite 90g","value":"sulfite_90","is_active":true,"price_effect":{"type":"none"}},{"label":"Couché 90g","value":"couche_90","is_active":true,"price_effect":{"type":"none"}},{"label":"Couché 115g","value":"couche_115","is_active":true,"price_effect":{"type":"none"}}]'::jsonb where id = pg_temp.fid('livreto-grampo-canoa', 'papel_miolo');
update public.service_fields set options = '[{"label":"Colorida só por fora (4x0)","value":"4x0","is_active":true,"price_effect":{"type":"none"}},{"label":"Colorida por fora e por dentro (4x4)","value":"4x4","is_active":true,"price_effect":{"type":"none"}},{"label":"Preto e branco","value":"pb","is_active":true,"price_effect":{"type":"none"}}]'::jsonb where id = pg_temp.fid('livreto-grampo-canoa', 'cor_capa');
update public.service_fields set options = '[{"label":"Mesmo papel do miolo","value":"mesmo_miolo","is_active":true,"price_effect":{"type":"none"}},{"label":"Couché 150g","value":"couche_150","is_active":true,"price_effect":{"type":"none"}},{"label":"Couché 170g","value":"couche_170","is_active":true,"price_effect":{"type":"none"}},{"label":"Couché 250g","value":"couche_250","is_active":true,"price_effect":{"type":"none"}},{"label":"Papel-cartão 180g","value":"cartao_180","is_active":true,"price_effect":{"type":"none"}}]'::jsonb where id = pg_temp.fid('livreto-grampo-canoa', 'papel_capa');
update public.service_fields set options = '[{"label":"Sem laminação","value":"sem","is_active":true,"price_effect":{"type":"none"}},{"label":"Laminação fosca","value":"fosca","is_active":true,"price_effect":{"type":"none"}},{"label":"Laminação brilho","value":"brilho","is_active":true,"price_effect":{"type":"none"}}]'::jsonb where id = pg_temp.fid('livreto-grampo-canoa', 'laminacao');
update public.service_fields set options = '[{"label":"Grampo canoa + refile","value":"grampo_refile","is_active":true,"price_effect":{"type":"none"}},{"label":"Grampo canoa (sem refile)","value":"grampo","is_active":true,"price_effect":{"type":"none"}}]'::jsonb where id = pg_temp.fid('livreto-grampo-canoa', 'acabamento');
insert into pg_temp.paths values
('livreto-grampo-canoa','papel_miolo','sulfite_75','cor_miolo=pb'),
('livreto-grampo-canoa','papel_miolo','sulfite_90','cor_miolo=pb'),
('livreto-grampo-canoa','papel_miolo','sulfite_75','cor_miolo=colorido'),
('livreto-grampo-canoa','papel_miolo','sulfite_90','cor_miolo=colorido'),
('livreto-grampo-canoa','papel_miolo','couche_90','cor_miolo=colorido'),
('livreto-grampo-canoa','papel_miolo','couche_115','cor_miolo=colorido'),
('livreto-grampo-canoa','laminacao','sem','papel_capa=mesmo_miolo'),
('livreto-grampo-canoa','laminacao','sem','papel_capa=couche_150'),
('livreto-grampo-canoa','laminacao','sem','papel_capa=couche_170'),
('livreto-grampo-canoa','laminacao','fosca','papel_capa=couche_170'),
('livreto-grampo-canoa','laminacao','brilho','papel_capa=couche_170'),
('livreto-grampo-canoa','laminacao','sem','papel_capa=couche_250'),
('livreto-grampo-canoa','laminacao','fosca','papel_capa=couche_250'),
('livreto-grampo-canoa','laminacao','brilho','papel_capa=couche_250'),
('livreto-grampo-canoa','laminacao','sem','papel_capa=cartao_180'),
('livreto-grampo-canoa','laminacao','fosca','papel_capa=cartao_180'),
('livreto-grampo-canoa','laminacao','brilho','papel_capa=cartao_180');

-- panfletos-flyers
insert into public.services (name, slug, description, category_id, base_price_cents, pricing_fallback_behavior, pricing_profile, pricing_profile_config, commercial_mode, catalog_state, is_active, sort_order)
values ('Panfletos e flyers', 'panfletos-flyers', 'Panfletos e flyers para divulgação, em couché ou sulfite, só frente ou frente e verso.', null, 0, 'block', 'manual_quote', '{"require_complete_compatibility": true}'::jsonb, 'manual_quote', 'draft', false, 4);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('panfletos-flyers'), 'formato', 'Formato', 'select'::public.field_type, '[{"label":"10 x 15 cm (A6)","value":"a6","is_active":true,"price_effect":{"type":"none"}},{"label":"10 x 21 cm","value":"dl","is_active":true,"price_effect":{"type":"none"}},{"label":"15 x 21 cm (A5)","value":"a5","is_active":true,"price_effect":{"type":"none"}},{"label":"21 x 29,7 cm (A4)","value":"a4","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 10, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('panfletos-flyers'), 'impressao', 'Impressão', 'radio'::public.field_type, '[{"label":"Colorido só frente (4x0)","value":"4x0","is_active":true,"price_effect":{"type":"none"}},{"label":"Colorido frente e verso (4x4)","value":"4x4","is_active":true,"price_effect":{"type":"none"}},{"label":"Preto e branco só frente (1x0)","value":"1x0","is_active":true,"price_effect":{"type":"none"}},{"label":"Preto e branco frente e verso (1x1)","value":"1x1","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 20, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('panfletos-flyers'), 'papel', 'Papel', 'select'::public.field_type, '[{"label":"Couché brilho","value":"couche_brilho","is_active":true,"price_effect":{"type":"none"}},{"label":"Couché fosco","value":"couche_fosco","is_active":true,"price_effect":{"type":"none"}},{"label":"Sulfite (offset)","value":"sulfite","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 30, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('panfletos-flyers'), 'gramatura', 'Gramatura', 'select'::public.field_type, '[{"label":"75g","value":"g75","is_active":true,"price_effect":{"type":"none"}},{"label":"90g","value":"g90","is_active":true,"price_effect":{"type":"none"}},{"label":"115g","value":"g115","is_active":true,"price_effect":{"type":"none"}},{"label":"120g","value":"g120","is_active":true,"price_effect":{"type":"none"}},{"label":"150g","value":"g150","is_active":true,"price_effect":{"type":"none"}},{"label":"170g","value":"g170","is_active":true,"price_effect":{"type":"none"}},{"label":"250g","value":"g250","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 40, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('panfletos-flyers'), 'acabamento', 'Acabamento', 'radio'::public.field_type, '[{"label":"Só corte (refile)","value":"refile","is_active":true,"price_effect":{"type":"none"}},{"label":"Laminação fosca","value":"lam_fosca","is_active":true,"price_effect":{"type":"none"}},{"label":"Laminação brilho","value":"lam_brilho","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 50, true);
insert into pg_temp.paths values
('panfletos-flyers','gramatura','g75','papel=sulfite'),
('panfletos-flyers','gramatura','g90','papel=sulfite'),
('panfletos-flyers','gramatura','g120','papel=sulfite'),
('panfletos-flyers','gramatura','g90','papel=couche_brilho'),
('panfletos-flyers','gramatura','g115','papel=couche_brilho'),
('panfletos-flyers','gramatura','g150','papel=couche_brilho'),
('panfletos-flyers','gramatura','g170','papel=couche_brilho'),
('panfletos-flyers','gramatura','g250','papel=couche_brilho'),
('panfletos-flyers','gramatura','g90','papel=couche_fosco'),
('panfletos-flyers','gramatura','g115','papel=couche_fosco'),
('panfletos-flyers','gramatura','g150','papel=couche_fosco'),
('panfletos-flyers','gramatura','g170','papel=couche_fosco'),
('panfletos-flyers','gramatura','g250','papel=couche_fosco'),
('panfletos-flyers','acabamento','refile','papel=sulfite;gramatura=g75'),
('panfletos-flyers','acabamento','refile','papel=sulfite;gramatura=g90'),
('panfletos-flyers','acabamento','refile','papel=sulfite;gramatura=g120'),
('panfletos-flyers','acabamento','refile','papel=couche_brilho;gramatura=g90'),
('panfletos-flyers','acabamento','refile','papel=couche_brilho;gramatura=g115'),
('panfletos-flyers','acabamento','refile','papel=couche_fosco;gramatura=g90'),
('panfletos-flyers','acabamento','refile','papel=couche_fosco;gramatura=g115'),
('panfletos-flyers','acabamento','refile','papel=couche_brilho;gramatura=g150'),
('panfletos-flyers','acabamento','lam_fosca','papel=couche_brilho;gramatura=g150'),
('panfletos-flyers','acabamento','lam_brilho','papel=couche_brilho;gramatura=g150'),
('panfletos-flyers','acabamento','refile','papel=couche_brilho;gramatura=g170'),
('panfletos-flyers','acabamento','lam_fosca','papel=couche_brilho;gramatura=g170'),
('panfletos-flyers','acabamento','lam_brilho','papel=couche_brilho;gramatura=g170'),
('panfletos-flyers','acabamento','refile','papel=couche_brilho;gramatura=g250'),
('panfletos-flyers','acabamento','lam_fosca','papel=couche_brilho;gramatura=g250'),
('panfletos-flyers','acabamento','lam_brilho','papel=couche_brilho;gramatura=g250'),
('panfletos-flyers','acabamento','refile','papel=couche_fosco;gramatura=g150'),
('panfletos-flyers','acabamento','lam_fosca','papel=couche_fosco;gramatura=g150'),
('panfletos-flyers','acabamento','lam_brilho','papel=couche_fosco;gramatura=g150'),
('panfletos-flyers','acabamento','refile','papel=couche_fosco;gramatura=g170'),
('panfletos-flyers','acabamento','lam_fosca','papel=couche_fosco;gramatura=g170'),
('panfletos-flyers','acabamento','lam_brilho','papel=couche_fosco;gramatura=g170'),
('panfletos-flyers','acabamento','refile','papel=couche_fosco;gramatura=g250'),
('panfletos-flyers','acabamento','lam_fosca','papel=couche_fosco;gramatura=g250'),
('panfletos-flyers','acabamento','lam_brilho','papel=couche_fosco;gramatura=g250');

-- folders
insert into public.services (name, slug, description, category_id, base_price_cents, pricing_fallback_behavior, pricing_profile, pricing_profile_config, commercial_mode, catalog_state, is_active, sort_order)
values ('Folders', 'folders', 'Folders dobrados em A4 ou A3, com 1, 2 ou 3 dobras, em couché.', null, 0, 'block', 'manual_quote', '{"require_complete_compatibility": true}'::jsonb, 'manual_quote', 'draft', false, 5);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('folders'), 'formato_aberto', 'Tamanho aberto', 'select'::public.field_type, '[{"label":"A4 aberto (21 x 29,7 cm)","value":"a4","is_active":true,"price_effect":{"type":"none"}},{"label":"A3 aberto (29,7 x 42 cm)","value":"a3","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 10, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('folders'), 'dobra', 'Tipo de dobra', 'select'::public.field_type, '[{"label":"1 dobra (4 faces)","value":"uma","is_active":true,"price_effect":{"type":"none"}},{"label":"2 dobras sanfona / zigue-zague (6 faces)","value":"duas_sanfona","is_active":true,"price_effect":{"type":"none"}},{"label":"2 dobras carteira (6 faces)","value":"duas_carteira","is_active":true,"price_effect":{"type":"none"}},{"label":"3 dobras sanfona (8 faces)","value":"tres_sanfona","is_active":true,"price_effect":{"type":"none"}},{"label":"Dobra cruzada (8 faces)","value":"cruzada","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 20, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('folders'), 'impressao', 'Impressão', 'radio'::public.field_type, '[{"label":"Colorido frente e verso (4x4)","value":"4x4","is_active":true,"price_effect":{"type":"none"}},{"label":"Colorido só de um lado (4x0)","value":"4x0","is_active":true,"price_effect":{"type":"none"}},{"label":"Preto e branco frente e verso (1x1)","value":"1x1","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 30, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('folders'), 'papel', 'Papel', 'select'::public.field_type, '[{"label":"Couché brilho","value":"couche_brilho","is_active":true,"price_effect":{"type":"none"}},{"label":"Couché fosco","value":"couche_fosco","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 40, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('folders'), 'gramatura', 'Gramatura', 'select'::public.field_type, '[{"label":"115g","value":"g115","is_active":true,"price_effect":{"type":"none"}},{"label":"150g","value":"g150","is_active":true,"price_effect":{"type":"none"}},{"label":"170g","value":"g170","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 50, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('folders'), 'acabamento', 'Acabamento', 'radio'::public.field_type, '[{"label":"Sem laminação","value":"sem","is_active":true,"price_effect":{"type":"none"}},{"label":"Laminação fosca","value":"lam_fosca","is_active":true,"price_effect":{"type":"none"}},{"label":"Laminação brilho","value":"lam_brilho","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 60, true);
insert into pg_temp.paths values
('folders','dobra','uma','formato_aberto=a4'),
('folders','dobra','duas_sanfona','formato_aberto=a4'),
('folders','dobra','duas_carteira','formato_aberto=a4'),
('folders','dobra','uma','formato_aberto=a3'),
('folders','dobra','duas_sanfona','formato_aberto=a3'),
('folders','dobra','duas_carteira','formato_aberto=a3'),
('folders','dobra','tres_sanfona','formato_aberto=a3'),
('folders','dobra','cruzada','formato_aberto=a3'),
('folders','acabamento','sem','gramatura=g115'),
('folders','acabamento','sem','gramatura=g150'),
('folders','acabamento','lam_fosca','gramatura=g150'),
('folders','acabamento','lam_brilho','gramatura=g150'),
('folders','acabamento','sem','gramatura=g170'),
('folders','acabamento','lam_fosca','gramatura=g170'),
('folders','acabamento','lam_brilho','gramatura=g170');

-- encadernacao
insert into public.services (name, slug, description, category_id, base_price_cents, pricing_fallback_behavior, pricing_profile, pricing_profile_config, commercial_mode, catalog_state, is_active, sort_order)
values ('Encadernação', 'encadernacao', 'Apostilas, trabalhos e TCC: espiral, wire-o, capa dura ou grampo. Pode imprimir aqui ou trazer já impresso.', null, 0, 'block', 'manual_quote', '{"require_complete_compatibility": true}'::jsonb, 'manual_quote', 'draft', false, 1);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('encadernacao'), 'tipo', 'Tipo de encadernação', 'radio'::public.field_type, '[{"label":"Espiral plástico","value":"espiral","is_active":true,"price_effect":{"type":"none"}},{"label":"Wire-o (garra de duplo anel)","value":"wireo","is_active":true,"price_effect":{"type":"none"}},{"label":"Capa dura (TCC, livros)","value":"capa_dura","is_active":true,"price_effect":{"type":"none"}},{"label":"Grampeado no canto","value":"grampo","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 10, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('encadernacao'), 'tamanho', 'Tamanho', 'select'::public.field_type, '[{"label":"A4","value":"a4","is_active":true,"price_effect":{"type":"none"}},{"label":"A5","value":"a5","is_active":true,"price_effect":{"type":"none"}},{"label":"Ofício","value":"oficio","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 20, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('encadernacao'), 'impressao', 'Impressão das páginas', 'select'::public.field_type, '[{"label":"Imprimir em preto e branco","value":"pb","is_active":true,"price_effect":{"type":"none"}},{"label":"Imprimir colorido","value":"colorido","is_active":true,"price_effect":{"type":"none"}},{"label":"Imprimir misto (cor só onde precisar)","value":"misto","is_active":true,"price_effect":{"type":"none"}},{"label":"Já está impresso (só encadernar)","value":"ja_impresso","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 30, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('encadernacao'), 'lados', 'Lados', 'radio'::public.field_type, '[{"label":"Só frente","value":"frente","is_active":true,"price_effect":{"type":"none"}},{"label":"Frente e verso","value":"frente_verso","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 40, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('encadernacao'), 'capa', 'Capa (frente)', 'select'::public.field_type, '[{"label":"PVC transparente","value":"pvc_transparente","is_active":true,"price_effect":{"type":"none"}},{"label":"Capa impressa em papel-cartão","value":"papel_cartao","is_active":true,"price_effect":{"type":"none"}},{"label":"Sem capa","value":"sem","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 50, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('encadernacao'), 'contracapa', 'Contracapa (fundo)', 'select'::public.field_type, '[{"label":"PVC preto","value":"pvc_preto","is_active":true,"price_effect":{"type":"none"}},{"label":"Papel-cartão","value":"papel_cartao","is_active":true,"price_effect":{"type":"none"}},{"label":"Sem contracapa","value":"sem","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 60, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('encadernacao'), 'cor_espiral', 'Cor do espiral / wire-o', 'select'::public.field_type, '[{"label":"Preto","value":"preto","is_active":true,"price_effect":{"type":"none"}},{"label":"Branco","value":"branco","is_active":true,"price_effect":{"type":"none"}},{"label":"Transparente","value":"transparente","is_active":true,"price_effect":{"type":"none"}},{"label":"Prata","value":"prata","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 70, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('encadernacao'), 'cor_capa_dura', 'Cor da capa dura', 'select'::public.field_type, '[{"label":"Preto","value":"preto","is_active":true,"price_effect":{"type":"none"}},{"label":"Azul-marinho","value":"azul","is_active":true,"price_effect":{"type":"none"}},{"label":"Verde","value":"verde","is_active":true,"price_effect":{"type":"none"}},{"label":"Vinho","value":"vinho","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 80, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('encadernacao'), 'gravacao', 'Gravação da capa dura', 'select'::public.field_type, '[{"label":"Gravação dourada","value":"dourada","is_active":true,"price_effect":{"type":"none"}},{"label":"Gravação prateada","value":"prateada","is_active":true,"price_effect":{"type":"none"}},{"label":"Sem gravação","value":"sem","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 90, true);
insert into pg_temp.paths values
('encadernacao','tamanho','a4','tipo=capa_dura'),
('encadernacao','tamanho','a5','tipo=capa_dura'),
('encadernacao','cor_capa_dura','preto','tipo=capa_dura'),
('encadernacao','cor_capa_dura','azul','tipo=capa_dura'),
('encadernacao','cor_capa_dura','verde','tipo=capa_dura'),
('encadernacao','cor_capa_dura','vinho','tipo=capa_dura'),
('encadernacao','gravacao','dourada','tipo=capa_dura'),
('encadernacao','gravacao','prateada','tipo=capa_dura'),
('encadernacao','gravacao','sem','tipo=capa_dura'),
('encadernacao','tamanho','a4','tipo=espiral'),
('encadernacao','tamanho','a5','tipo=espiral'),
('encadernacao','tamanho','oficio','tipo=espiral'),
('encadernacao','tamanho','a4','tipo=wireo'),
('encadernacao','tamanho','a5','tipo=wireo'),
('encadernacao','tamanho','oficio','tipo=wireo'),
('encadernacao','tamanho','a4','tipo=grampo'),
('encadernacao','tamanho','a5','tipo=grampo'),
('encadernacao','tamanho','oficio','tipo=grampo'),
('encadernacao','capa','pvc_transparente','tipo=espiral'),
('encadernacao','capa','papel_cartao','tipo=espiral'),
('encadernacao','capa','sem','tipo=espiral'),
('encadernacao','contracapa','pvc_preto','tipo=espiral'),
('encadernacao','contracapa','papel_cartao','tipo=espiral'),
('encadernacao','cor_espiral','preto','tipo=espiral'),
('encadernacao','cor_espiral','branco','tipo=espiral'),
('encadernacao','cor_espiral','transparente','tipo=espiral'),
('encadernacao','capa','pvc_transparente','tipo=wireo'),
('encadernacao','capa','papel_cartao','tipo=wireo'),
('encadernacao','contracapa','pvc_preto','tipo=wireo'),
('encadernacao','contracapa','papel_cartao','tipo=wireo'),
('encadernacao','cor_espiral','preto','tipo=wireo'),
('encadernacao','cor_espiral','branco','tipo=wireo'),
('encadernacao','cor_espiral','prata','tipo=wireo'),
('encadernacao','capa','papel_cartao','tipo=grampo'),
('encadernacao','capa','sem','tipo=grampo'),
('encadernacao','contracapa','papel_cartao','tipo=grampo'),
('encadernacao','contracapa','sem','tipo=grampo'),
('encadernacao','lados','frente','impressao=pb'),
('encadernacao','lados','frente_verso','impressao=pb'),
('encadernacao','lados','frente','impressao=colorido'),
('encadernacao','lados','frente_verso','impressao=colorido'),
('encadernacao','lados','frente','impressao=misto'),
('encadernacao','lados','frente_verso','impressao=misto');

-- banners-faixas
insert into public.services (name, slug, description, category_id, base_price_cents, pricing_fallback_behavior, pricing_profile, pricing_profile_config, commercial_mode, catalog_state, is_active, sort_order)
values ('Banners e faixas', 'banners-faixas', 'Banners com bastão e cordão, faixas com ilhós e lona refilada, em lona 280g ou 440g.', null, 0, 'block', 'manual_quote', '{"require_complete_compatibility": true}'::jsonb, 'manual_quote', 'draft', false, 6);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('banners-faixas'), 'tipo', 'Tipo', 'radio'::public.field_type, '[{"label":"Banner (bastão e cordão)","value":"banner","is_active":true,"price_effect":{"type":"none"}},{"label":"Faixa (com ilhós)","value":"faixa","is_active":true,"price_effect":{"type":"none"}},{"label":"Lona só refilada","value":"lona","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 10, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('banners-faixas'), 'tamanho', 'Tamanho', 'select'::public.field_type, '[{"label":"60 x 90 cm","value":"60x90","is_active":true,"price_effect":{"type":"none"}},{"label":"80 x 120 cm","value":"80x120","is_active":true,"price_effect":{"type":"none"}},{"label":"100 x 150 cm","value":"100x150","is_active":true,"price_effect":{"type":"none"}},{"label":"70 cm x 3 m","value":"70x300","is_active":true,"price_effect":{"type":"none"}},{"label":"1 x 3 m","value":"100x300","is_active":true,"price_effect":{"type":"none"}},{"label":"1 x 5 m","value":"100x500","is_active":true,"price_effect":{"type":"none"}},{"label":"Outro tamanho (informe abaixo)","value":"outro","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 20, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('banners-faixas'), 'material', 'Material', 'select'::public.field_type, '[{"label":"Lona 280g brilho","value":"lona_280","is_active":true,"price_effect":{"type":"none"}},{"label":"Lona 440g (mais resistente)","value":"lona_440","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 30, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('banners-faixas'), 'medidas', 'Medidas ou observações', 'text'::public.field_type, '[]'::jsonb, false, 40, true);
insert into pg_temp.paths values
('banners-faixas','tamanho','60x90','tipo=banner'),
('banners-faixas','tamanho','80x120','tipo=banner'),
('banners-faixas','tamanho','100x150','tipo=banner'),
('banners-faixas','tamanho','outro','tipo=banner'),
('banners-faixas','tamanho','70x300','tipo=faixa'),
('banners-faixas','tamanho','100x300','tipo=faixa'),
('banners-faixas','tamanho','100x500','tipo=faixa'),
('banners-faixas','tamanho','outro','tipo=faixa'),
('banners-faixas','tamanho','60x90','tipo=lona'),
('banners-faixas','tamanho','80x120','tipo=lona'),
('banners-faixas','tamanho','100x150','tipo=lona'),
('banners-faixas','tamanho','70x300','tipo=lona'),
('banners-faixas','tamanho','100x300','tipo=lona'),
('banners-faixas','tamanho','100x500','tipo=lona'),
('banners-faixas','tamanho','outro','tipo=lona');

-- adesivos-etiquetas
insert into public.services (name, slug, description, category_id, base_price_cents, pricing_fallback_behavior, pricing_profile, pricing_profile_config, commercial_mode, catalog_state, is_active, sort_order)
values ('Adesivos e etiquetas', 'adesivos-etiquetas', 'Adesivos em vinil ou papel adesivo, em folha inteira, cortados em unidades ou recortados no contorno.', null, 0, 'block', 'manual_quote', '{"require_complete_compatibility": true}'::jsonb, 'manual_quote', 'draft', false, 7);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('adesivos-etiquetas'), 'material', 'Material', 'select'::public.field_type, '[{"label":"Vinil branco brilho","value":"vinil_brilho","is_active":true,"price_effect":{"type":"none"}},{"label":"Vinil branco fosco","value":"vinil_fosco","is_active":true,"price_effect":{"type":"none"}},{"label":"Vinil transparente","value":"vinil_transparente","is_active":true,"price_effect":{"type":"none"}},{"label":"Papel adesivo (uso interno)","value":"papel_adesivo","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 10, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('adesivos-etiquetas'), 'corte', 'Corte', 'radio'::public.field_type, '[{"label":"Folha inteira (sem corte)","value":"folha","is_active":true,"price_effect":{"type":"none"}},{"label":"Corte reto em unidades","value":"reto","is_active":true,"price_effect":{"type":"none"}},{"label":"Recorte no contorno do desenho","value":"contorno","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 20, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('adesivos-etiquetas'), 'formato', 'Formato', 'select'::public.field_type, '[{"label":"Folha A4","value":"a4","is_active":true,"price_effect":{"type":"none"}},{"label":"Folha A3","value":"a3","is_active":true,"price_effect":{"type":"none"}},{"label":"Medida personalizada","value":"personalizado","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 30, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('adesivos-etiquetas'), 'laminacao', 'Laminação', 'radio'::public.field_type, '[{"label":"Sem laminação","value":"sem","is_active":true,"price_effect":{"type":"none"}},{"label":"Laminação brilho","value":"brilho","is_active":true,"price_effect":{"type":"none"}},{"label":"Laminação fosca","value":"fosca","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 40, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('adesivos-etiquetas'), 'medidas', 'Medida de cada adesivo (ex.: 5 x 5 cm)', 'text'::public.field_type, '[]'::jsonb, false, 50, true);
insert into pg_temp.paths values
('adesivos-etiquetas','formato','a4','corte=folha'),
('adesivos-etiquetas','formato','a3','corte=folha'),
('adesivos-etiquetas','formato','a4','corte=reto'),
('adesivos-etiquetas','formato','a3','corte=reto'),
('adesivos-etiquetas','formato','personalizado','corte=reto'),
('adesivos-etiquetas','formato','a4','corte=contorno'),
('adesivos-etiquetas','formato','a3','corte=contorno'),
('adesivos-etiquetas','formato','personalizado','corte=contorno');

-- convites
insert into public.services (name, slug, description, category_id, base_price_cents, pricing_fallback_behavior, pricing_profile, pricing_profile_config, commercial_mode, catalog_state, is_active, sort_order)
values ('Convites', 'convites', 'Convites de aniversário, casamento e eventos em couché ou papéis especiais, com ou sem envelope.', null, 0, 'block', 'manual_quote', '{"require_complete_compatibility": true}'::jsonb, 'manual_quote', 'draft', false, 8);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('convites'), 'formato', 'Formato', 'select'::public.field_type, '[{"label":"10 x 15 cm","value":"10x15","is_active":true,"price_effect":{"type":"none"}},{"label":"10 x 21 cm","value":"10x21","is_active":true,"price_effect":{"type":"none"}},{"label":"15 x 15 cm","value":"15x15","is_active":true,"price_effect":{"type":"none"}},{"label":"15 x 21 cm (A5)","value":"15x21","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 10, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('convites'), 'papel', 'Papel', 'select'::public.field_type, '[{"label":"Couché fosco 250g","value":"couche_250","is_active":true,"price_effect":{"type":"none"}},{"label":"Couché 300g","value":"couche_300","is_active":true,"price_effect":{"type":"none"}},{"label":"Perolado 180g","value":"perolado","is_active":true,"price_effect":{"type":"none"}},{"label":"Vergê 180g","value":"verge","is_active":true,"price_effect":{"type":"none"}},{"label":"Color Plus 180g","value":"color_plus","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 20, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('convites'), 'impressao', 'Impressão', 'radio'::public.field_type, '[{"label":"Colorido só frente (4x0)","value":"4x0","is_active":true,"price_effect":{"type":"none"}},{"label":"Colorido frente e verso (4x4)","value":"4x4","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 30, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('convites'), 'acabamento', 'Acabamento', 'radio'::public.field_type, '[{"label":"Só corte (refile)","value":"refile","is_active":true,"price_effect":{"type":"none"}},{"label":"Laminação fosca","value":"lam_fosca","is_active":true,"price_effect":{"type":"none"}},{"label":"Laminação brilho","value":"lam_brilho","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 40, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('convites'), 'envelope', 'Envelope', 'radio'::public.field_type, '[{"label":"Sem envelope","value":"sem","is_active":true,"price_effect":{"type":"none"}},{"label":"Com envelope","value":"com","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 50, true);
insert into pg_temp.paths values
('convites','acabamento','refile','papel=couche_250'),
('convites','acabamento','lam_fosca','papel=couche_250'),
('convites','acabamento','lam_brilho','papel=couche_250'),
('convites','acabamento','refile','papel=couche_300'),
('convites','acabamento','lam_fosca','papel=couche_300'),
('convites','acabamento','lam_brilho','papel=couche_300'),
('convites','acabamento','refile','papel=perolado'),
('convites','acabamento','refile','papel=verge'),
('convites','acabamento','refile','papel=color_plus');

-- impressao-fotos
insert into public.services (name, slug, description, category_id, base_price_cents, pricing_fallback_behavior, pricing_profile, pricing_profile_config, commercial_mode, catalog_state, is_active, sort_order)
values ('Impressão de fotos', 'impressao-fotos', 'Fotos em papel fotográfico brilho ou fosco, de 10 x 15 cm até A4.', null, 0, 'block', 'manual_quote', '{"require_complete_compatibility": true}'::jsonb, 'manual_quote', 'draft', false, 9);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('impressao-fotos'), 'tamanho', 'Tamanho', 'select'::public.field_type, '[{"label":"10 x 15 cm","value":"10x15","is_active":true,"price_effect":{"type":"none"}},{"label":"13 x 18 cm","value":"13x18","is_active":true,"price_effect":{"type":"none"}},{"label":"15 x 21 cm","value":"15x21","is_active":true,"price_effect":{"type":"none"}},{"label":"21 x 29,7 cm (A4)","value":"a4","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 10, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('impressao-fotos'), 'papel', 'Papel', 'radio'::public.field_type, '[{"label":"Fotográfico brilho","value":"brilho","is_active":true,"price_effect":{"type":"none"}},{"label":"Fotográfico fosco","value":"fosco","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 20, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('impressao-fotos'), 'gramatura', 'Gramatura', 'radio'::public.field_type, '[{"label":"180g","value":"g180","is_active":true,"price_effect":{"type":"none"}},{"label":"230g","value":"g230","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 30, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('impressao-fotos'), 'borda', 'Borda', 'radio'::public.field_type, '[{"label":"Sem borda","value":"sem","is_active":true,"price_effect":{"type":"none"}},{"label":"Com borda branca","value":"com","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 40, true);

-- blocos-taloes
insert into public.services (name, slug, description, category_id, base_price_cents, pricing_fallback_behavior, pricing_profile, pricing_profile_config, commercial_mode, catalog_state, is_active, sort_order)
values ('Blocos e talões', 'blocos-taloes', 'Receituários, blocos de pedido, recibos e blocos de anotação, em 1, 2 ou 3 vias.', null, 0, 'block', 'manual_quote', '{"require_complete_compatibility": true}'::jsonb, 'manual_quote', 'draft', false, 10);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('blocos-taloes'), 'tipo', 'Tipo de bloco', 'select'::public.field_type, '[{"label":"Receituário","value":"receituario","is_active":true,"price_effect":{"type":"none"}},{"label":"Pedido / orçamento","value":"pedido","is_active":true,"price_effect":{"type":"none"}},{"label":"Recibo","value":"recibo","is_active":true,"price_effect":{"type":"none"}},{"label":"Bloco de anotações","value":"anotacoes","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 10, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('blocos-taloes'), 'formato', 'Formato', 'select'::public.field_type, '[{"label":"10 x 15 cm (A6)","value":"a6","is_active":true,"price_effect":{"type":"none"}},{"label":"15 x 21 cm (A5)","value":"a5","is_active":true,"price_effect":{"type":"none"}},{"label":"21 x 29,7 cm (A4)","value":"a4","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 20, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('blocos-taloes'), 'vias', 'Vias', 'radio'::public.field_type, '[{"label":"1 via","value":"uma","is_active":true,"price_effect":{"type":"none"}},{"label":"2 vias (papel autocopiativo)","value":"duas","is_active":true,"price_effect":{"type":"none"}},{"label":"3 vias (papel autocopiativo)","value":"tres","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 30, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('blocos-taloes'), 'folhas', 'Folhas por bloco', 'radio'::public.field_type, '[{"label":"50 folhas (ou 50 jogos)","value":"f50","is_active":true,"price_effect":{"type":"none"}},{"label":"100 folhas","value":"f100","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 40, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('blocos-taloes'), 'impressao', 'Impressão', 'radio'::public.field_type, '[{"label":"Preto e branco","value":"1x0","is_active":true,"price_effect":{"type":"none"}},{"label":"Colorido","value":"4x0","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 50, true);
insert into public.service_fields (service_id, key, label, field_type, options, is_required, sort_order, is_active) values (pg_temp.sid('blocos-taloes'), 'numeracao', 'Numeração', 'radio'::public.field_type, '[{"label":"Sem numeração","value":"sem","is_active":true,"price_effect":{"type":"none"}},{"label":"Numerado","value":"com","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 60, true);
insert into pg_temp.paths values
('blocos-taloes','vias','uma','tipo=anotacoes'),
('blocos-taloes','numeracao','sem','tipo=anotacoes'),
('blocos-taloes','vias','uma','tipo=receituario'),
('blocos-taloes','vias','duas','tipo=receituario'),
('blocos-taloes','vias','tres','tipo=receituario'),
('blocos-taloes','numeracao','sem','tipo=receituario'),
('blocos-taloes','numeracao','com','tipo=receituario'),
('blocos-taloes','vias','uma','tipo=pedido'),
('blocos-taloes','vias','duas','tipo=pedido'),
('blocos-taloes','vias','tres','tipo=pedido'),
('blocos-taloes','numeracao','sem','tipo=pedido'),
('blocos-taloes','numeracao','com','tipo=pedido'),
('blocos-taloes','vias','uma','tipo=recibo'),
('blocos-taloes','vias','duas','tipo=recibo'),
('blocos-taloes','vias','tres','tipo=recibo'),
('blocos-taloes','numeracao','sem','tipo=recibo'),
('blocos-taloes','numeracao','com','tipo=recibo'),
('blocos-taloes','folhas','f50','vias=uma'),
('blocos-taloes','folhas','f100','vias=uma'),
('blocos-taloes','folhas','f50','vias=duas'),
('blocos-taloes','folhas','f50','vias=tres');

-- Grava a árvore: cada condição "campo=opção" vira {field_id, option_value}, na ordem escrita.
insert into public.service_field_option_dependencies (service_id, source_field_id, source_option_value, source_conditions, target_field_id, target_option_value)
select pg_temp.sid(p.slug), (c.conditions -> 0 ->> 'field_id')::uuid, c.conditions -> 0 ->> 'option_value', c.conditions, pg_temp.fid(p.slug, p.target_key), p.target_value
from pg_temp.paths p
cross join lateral (
  select jsonb_agg(jsonb_build_object('field_id', pg_temp.fid(p.slug, split_part(part, '=', 1)), 'option_value', split_part(part, '=', 2)) order by ord) as conditions
  from unnest(string_to_array(p.conditions, ';')) with ordinality as t(part, ord)
) c;

-- Publica tudo (o gatilho de versão grava o snapshot do catálogo).
update public.services
set catalog_state = 'published', is_active = true, reviewed_at = now(), published_at = coalesce(published_at, now())
where slug in ('panfletos-flyers', 'folders', 'encadernacao', 'banners-faixas', 'adesivos-etiquetas', 'convites', 'impressao-fotos', 'blocos-taloes', 'impressao', 'cartoes-de-visita', 'plotagem', 'livreto-grampo-canoa') and deleted_at is null;
