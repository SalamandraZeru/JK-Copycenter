-- Imagens de catálogo são enviadas apenas pela rota administrativa server-side.
-- O bucket é público somente para servir as URLs usadas no catálogo; upload não
-- recebe política de cliente e permanece dependente da service role no servidor.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalog-images',
  'catalog-images',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
