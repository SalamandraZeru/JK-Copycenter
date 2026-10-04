import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, PackageOpen, ShieldCheck, Store } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ProductBuyBox } from '@/components/loja/ProductBuyBox';
import { ProductRailCard } from '@/components/loja/CompactCards';

export const revalidate = 60;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type CategoryRef = { name: string; slug: string };
type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  price: number;
  sku: string | null;
  unit_label: string | null;
  package_quantity: number | null;
  stock_quantity: number | null;
  stock_control_enabled: boolean;
  reserved_quantity: number | null;
  product_categories: { categories: CategoryRef | CategoryRef[] | null }[] | null;
};

async function loadProduct(slug: string): Promise<ProductRow | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, slug, description, image_url, price, sku, unit_label, package_quantity, stock_quantity, stock_control_enabled, reserved_quantity, product_categories(categories(name, slug))')
    .eq('slug', slug)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();
  if (error || !data) return null;
  return data as ProductRow;
}

// Outros produtos da mesma categoria (ou do catálogo, se não houver categoria).
async function loadRelated(product: ProductRow, categorySlug: string | null) {
  const supabase = await createClient();
  const select = 'id, name, slug, image_url, price, stock_quantity, stock_control_enabled, reserved_quantity';
  const query = categorySlug
    ? supabase.from('products').select(`${select}, product_categories!inner(categories!inner(slug))`).eq('product_categories.categories.slug', categorySlug)
    : supabase.from('products').select(select);
  const { data } = await query.eq('is_active', true).is('deleted_at', null).neq('id', product.id).order('sort_order').limit(10);
  return (data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    slug: item.slug,
    image_url: item.image_url,
    price: item.price,
    stock_quantity: item.stock_control_enabled && item.stock_quantity !== null
      ? Math.max(0, item.stock_quantity - (item.reserved_quantity ?? 0))
      : null,
  }));
}

function categoriesOf(product: ProductRow): CategoryRef[] {
  return (product.product_categories ?? []).flatMap((link) => {
    if (!link.categories) return [];
    return Array.isArray(link.categories) ? link.categories : [link.categories];
  });
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await loadProduct(slug);
  return {
    title: product?.name ?? 'Produto indisponível',
    description: product?.description?.slice(0, 160) ?? 'Papelaria e materiais na JK Copycenter, em Passos/MG.',
  };
}

export default async function ProdutoPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const product = await loadProduct(slug);
  if (!product) notFound();

  const categories = categoriesOf(product);
  const primaryCategory = categories[0] ?? null;
  const related = await loadRelated(product, primaryCategory?.slug ?? null);
  const availableStock = product.stock_control_enabled && product.stock_quantity !== null
    ? Math.max(0, product.stock_quantity - (product.reserved_quantity ?? 0))
    : null;

  const details: Array<{ label: string; value: string }> = [
    ...(product.sku ? [{ label: 'Código (SKU)', value: product.sku }] : []),
    { label: 'Unidade de venda', value: product.unit_label ?? 'unidade' },
    ...(product.package_quantity && product.package_quantity > 1
      ? [{ label: 'Itens por embalagem', value: String(product.package_quantity) }]
      : []),
    ...(categories.length ? [{ label: 'Categorias', value: categories.map((c) => c.name).join(', ') }] : []),
  ];

  return (
    <div className="jk-paper-grid min-h-screen">
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-10 lg:px-8">
        <Link href={primaryCategory ? `/papelaria?categoria=${primaryCategory.slug}` : '/papelaria'} className="mb-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-[#092653] sm:hidden">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {primaryCategory?.name ?? 'Papelaria'}
        </Link>
        <nav className="mb-6 hidden flex-wrap items-center gap-x-2 text-sm text-slate-500 sm:flex">
          <Link href="/" className="hover:text-[#092653]">Home</Link>
          <span>/</span>
          <Link href="/papelaria" className="hover:text-[#092653]">Papelaria</Link>
          {primaryCategory && <>
            <span>/</span>
            <Link href={`/papelaria?categoria=${primaryCategory.slug}`} className="hover:text-[#092653]">{primaryCategory.name}</Link>
          </>}
          <span>/</span>
          <span className="font-semibold text-slate-900">{product.name}</span>
        </nav>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.15fr_.85fr] lg:gap-10">
          {/* Imagem */}
          <div className="jk-reveal relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[#092653]/12 bg-white sm:aspect-square sm:rounded-3xl">
            {product.image_url ? (
              <Image src={product.image_url} alt={product.name} fill sizes="(min-width:1024px) 55vw, 100vw" className="object-contain p-6" priority />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[#092653]/25"><PackageOpen className="h-24 w-24" /></div>
            )}
          </div>

          {/* Info + buy box */}
          <div className="jk-reveal flex flex-col gap-4 sm:gap-5">
            <div>
              {primaryCategory && <p className="text-xs font-black uppercase tracking-[.18em] text-[#b4232d]">{primaryCategory.name}</p>}
              <h1 className="jk-display mt-1 text-2xl font-black leading-tight text-[#092653] sm:mt-2 sm:text-4xl">{product.name}</h1>
            </div>
            <ProductBuyBox
              product={{
                id: product.id,
                name: product.name,
                image_url: product.image_url,
                price: product.price,
                stockControlEnabled: product.stock_control_enabled,
                availableStock,
              }}
            />
            <div className="flex flex-col gap-2 rounded-2xl border border-[#092653]/12 bg-[#fffdf8] p-4 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2"><Store className="h-4 w-4 text-[#092653]" /> Retirada na loja em Passos/MG</span>
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#092653]" /> Pagamento confirmado pela equipe</span>
            </div>
          </div>
        </div>

        {/* Descrição + ficha técnica */}
        <div className="mt-8 grid gap-6 sm:mt-10 sm:gap-8 lg:grid-cols-[1.15fr_.85fr]">
          <section>
            <h2 className="jk-display text-2xl font-black text-[#092653]">Descrição</h2>
            <p className="mt-3 whitespace-pre-line leading-7 text-slate-700">
              {product.description?.trim() || 'Consulte a disponibilidade e mais detalhes deste item diretamente com a equipe da JK Copycenter.'}
            </p>
          </section>
          <section>
            <h2 className="jk-display text-2xl font-black text-[#092653]">Ficha técnica</h2>
            <dl className="mt-3 overflow-hidden rounded-2xl border border-[#092653]/12">
              {details.map((detail, index) => (
                <div key={detail.label} className={`flex justify-between gap-4 px-4 py-3 text-sm ${index % 2 === 0 ? 'bg-white' : 'bg-[#f4f0e8]/60'}`}>
                  <dt className="font-semibold text-slate-500">{detail.label}</dt>
                  <dd className="text-right font-bold text-[#092653]">{detail.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        {related.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-end justify-between gap-4">
              <h2 className="jk-display text-2xl font-black text-[#092653]">{primaryCategory ? `Mais em ${primaryCategory.name}` : 'Mais da papelaria'}</h2>
              <Link href={primaryCategory ? `/papelaria?categoria=${primaryCategory.slug}` : '/papelaria'} className="inline-flex min-h-10 flex-none items-center gap-1 text-sm font-bold text-[#b4232d] hover:underline">
                Ver todos <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="jk-rail -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-5">
              {related.map((item) => <ProductRailCard key={item.id} product={item} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
