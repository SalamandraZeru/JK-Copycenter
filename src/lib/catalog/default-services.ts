export interface DefaultServiceData {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string | null;
  base_price: number;
  sort_order: number;
  fields: Array<{
    id: string;
    key: string;
    label: string;
    field_type: 'select' | 'radio' | 'number' | 'text' | 'textarea' | 'checkbox';
    options: Array<{
      value: string;
      label: string;
      priceEffect?: { multiplier?: number; addedPrice?: number };
    }>;
    is_required: boolean;
    sort_order: number;
  }>;
  pricing_rules: Array<{
    id: string;
    service_id: string;
    name: string;
    price_per_page: number;
    fallback_behavior: string;
    is_active: boolean;
    attributes: Array<{ attribute_id: string }>;
  }>;
}

export const DEFAULT_SERVICES: DefaultServiceData[] = [
  {
    id: 'srv-impressao-pb',
    name: 'Impressão Preto e Branco (P&B)',
    slug: 'impressao-pb',
    description: 'Impressão digital rápida e nítida em alta velocidade. Ideal para apostilas, contratos, relatórios e documentos em geral.',
    image_url: null,
    base_price: 0.25,
    sort_order: 1,
    fields: [
      {
        id: 'f-formato-pb',
        key: 'formato',
        label: 'Tamanho do Papel',
        field_type: 'select',
        is_required: true,
        sort_order: 1,
        options: [
          { value: 'a4', label: 'A4 (21 x 29,7 cm)', priceEffect: { addedPrice: 0 } },
          { value: 'a3', label: 'A3 (29,7 x 42 cm)', priceEffect: { multiplier: 2.0 } },
          { value: 'oficio', label: 'Ofício / Carta', priceEffect: { addedPrice: 0.05 } },
        ],
      },
      {
        id: 'f-papel-pb',
        key: 'tipo_papel',
        label: 'Tipo de Papel',
        field_type: 'radio',
        is_required: true,
        sort_order: 2,
        options: [
          { value: 'sulfite_75g', label: 'Sulfite 75g (Padrão)', priceEffect: { addedPrice: 0 } },
          { value: 'sulfite_90g', label: 'Sulfite 90g (+ encorpado)', priceEffect: { addedPrice: 0.10 } },
          { value: 'reciclato_90g', label: 'Reciclato 90g (Ecológico)', priceEffect: { addedPrice: 0.15 } },
        ],
      },
      {
        id: 'f-acabamento-pb',
        key: 'acabamento',
        label: 'Acabamento Opcional',
        field_type: 'select',
        is_required: false,
        sort_order: 3,
        options: [
          { value: 'nenhum', label: 'Sem acabamento (folhas soltas)', priceEffect: { addedPrice: 0 } },
          { value: 'grampo', label: 'Grampeado no canto', priceEffect: { addedPrice: 0.50 } },
          { value: 'furacao', label: 'Furação 2 ou 4 furos', priceEffect: { addedPrice: 0.30 } },
        ],
      },
    ],
    pricing_rules: [
      {
        id: 'rule-pb-default',
        service_id: 'srv-impressao-pb',
        name: 'Tabela Padrão P&B',
        price_per_page: 0.25,
        fallback_behavior: 'use_base',
        is_active: true,
        attributes: [],
      },
    ],
  },
  {
    id: 'srv-impressao-colorida',
    name: 'Impressão Colorida Digital',
    slug: 'impressao-colorida',
    description: 'Cores vivas e fidelidade visual superior. Perfeita para apresentações, certificados, cardápios, apostilas ilustradas e portfólios.',
    image_url: null,
    base_price: 1.50,
    sort_order: 2,
    fields: [
      {
        id: 'f-formato-color',
        key: 'formato',
        label: 'Formato',
        field_type: 'select',
        is_required: true,
        sort_order: 1,
        options: [
          { value: 'a4', label: 'A4 (21 x 29,7 cm)', priceEffect: { addedPrice: 0 } },
          { value: 'a3', label: 'A3 (29,7 x 42 cm)', priceEffect: { multiplier: 2.0 } },
        ],
      },
      {
        id: 'f-papel-color',
        key: 'tipo_papel',
        label: 'Gramatura e Papel',
        field_type: 'radio',
        is_required: true,
        sort_order: 2,
        options: [
          { value: 'sulfite_75g', label: 'Sulfite 75g', priceEffect: { addedPrice: 0 } },
          { value: 'sulfite_120g', label: 'Sulfite Especial 120g', priceEffect: { addedPrice: 0.40 } },
          { value: 'couche_170g', label: 'Couchê 170g (Semi-brilho)', priceEffect: { addedPrice: 0.80 } },
          { value: 'couche_250g', label: 'Couchê Pesado 250g', priceEffect: { addedPrice: 1.20 } },
        ],
      },
    ],
    pricing_rules: [
      {
        id: 'rule-color-default',
        service_id: 'srv-impressao-colorida',
        name: 'Tabela Padrão Colorida',
        price_per_page: 1.50,
        fallback_behavior: 'use_base',
        is_active: true,
        attributes: [],
      },
    ],
  },
  {
    id: 'srv-encadernacao',
    name: 'Encadernação & Plastificação',
    slug: 'encadernacao-plastificacao',
    description: 'Acabamentos profissionais para proteção e valorização dos seus documentos. Espiral, Wire-o e Plastificação Polaseal.',
    image_url: null,
    base_price: 5.00,
    sort_order: 3,
    fields: [
      {
        id: 'f-tipo-encadernacao',
        key: 'tipo',
        label: 'Tipo de Encadernação',
        field_type: 'radio',
        is_required: true,
        sort_order: 1,
        options: [
          { value: 'espiral', label: 'Espiral Plástico + Capa Cristal/Preta', priceEffect: { addedPrice: 0 } },
          { value: 'wire_o', label: 'Wire-o Metálico (Duplo Anel)', priceEffect: { addedPrice: 7.00 } },
          { value: 'plastificacao_a4', label: 'Plastificação Rígida Polaseal A4', priceEffect: { addedPrice: 2.00 } },
        ],
      },
    ],
    pricing_rules: [
      {
        id: 'rule-encadernacao-default',
        service_id: 'srv-encadernacao',
        name: 'Tabela Encadernação',
        price_per_page: 5.00,
        fallback_behavior: 'use_base',
        is_active: true,
        attributes: [],
      },
    ],
  },
  {
    id: 'srv-banners-lona',
    name: 'Banners e Faixas em Lona',
    slug: 'banners-lona',
    description: 'Impressão em lona vinílica fosca ou brilhante de alta durabilidade com acabamento em bastão, ponteira e cordão ou ilhós.',
    image_url: null,
    base_price: 45.00,
    sort_order: 4,
    fields: [
      {
        id: 'f-tamanho-banner',
        key: 'tamanho',
        label: 'Dimensões do Banner',
        field_type: 'select',
        is_required: true,
        sort_order: 1,
        options: [
          { value: '60x90', label: '60 x 90 cm (Padrão)', priceEffect: { addedPrice: 0 } },
          { value: '80x120', label: '80 x 120 cm (Médio)', priceEffect: { addedPrice: 25.00 } },
          { value: '100x150', label: '100 x 150 cm (Grande)', priceEffect: { addedPrice: 50.00 } },
        ],
      },
      {
        id: 'f-acabamento-banner',
        key: 'acabamento_lona',
        label: 'Acabamento',
        field_type: 'radio',
        is_required: true,
        sort_order: 2,
        options: [
          { value: 'bastao_cordao', label: 'Bastão de madeira, ponteiras e cordão', priceEffect: { addedPrice: 0 } },
          { value: 'ilhos', label: 'Reforço perimetral com Ilhós metálicos', priceEffect: { addedPrice: 5.00 } },
        ],
      },
    ],
    pricing_rules: [
      {
        id: 'rule-banner-default',
        service_id: 'srv-banners-lona',
        name: 'Tabela Banners',
        price_per_page: 45.00,
        fallback_behavior: 'use_base',
        is_active: true,
        attributes: [],
      },
    ],
  },
  {
    id: 'srv-cartoes-visita',
    name: 'Cartões de Visita Profissionais',
    slug: 'cartoes-visita',
    description: 'Primeira impressão impecável. Papel Couchê 300g com opções de verniz localizado e laminação fosca premium (Cento ou Milheiro).',
    image_url: null,
    base_price: 60.00,
    sort_order: 5,
    fields: [
      {
        id: 'f-qtd-cartao',
        key: 'tiragem',
        label: 'Quantidade',
        field_type: 'select',
        is_required: true,
        sort_order: 1,
        options: [
          { value: '100', label: '100 unidades', priceEffect: { addedPrice: 0 } },
          { value: '500', label: '500 unidades', priceEffect: { addedPrice: 35.00 } },
          { value: '1000', label: '1.000 unidades (Melhor custo/benefício)', priceEffect: { addedPrice: 55.00 } },
        ],
      },
      {
        id: 'f-enobrecimento',
        key: 'acabamento_cartao',
        label: 'Enobrecimento',
        field_type: 'radio',
        is_required: true,
        sort_order: 2,
        options: [
          { value: 'laminacao_fosca', label: 'Laminação Fosca', priceEffect: { addedPrice: 0 } },
          { value: 'verniz_localizado', label: 'Laminação Fosca + Verniz Localizado UV', priceEffect: { addedPrice: 25.00 } },
        ],
      },
    ],
    pricing_rules: [
      {
        id: 'rule-cartao-default',
        service_id: 'srv-cartoes-visita',
        name: 'Tabela Cartões',
        price_per_page: 60.00,
        fallback_behavior: 'use_base',
        is_active: true,
        attributes: [],
      },
    ],
  },
  {
    id: 'srv-adesivos-vinil',
    name: 'Adesivos e Rótulos Personalizados',
    slug: 'adesivos-personalizados',
    description: 'Adesivos em vinil à prova d’água com recorte eletrônico preciso em qualquer formato (redondo, quadrado ou personalizado).',
    image_url: null,
    base_price: 25.00,
    sort_order: 6,
    fields: [
      {
        id: 'f-material-adesivo',
        key: 'material',
        label: 'Material do Adesivo',
        field_type: 'radio',
        is_required: true,
        sort_order: 1,
        options: [
          { value: 'vinil_brilho', label: 'Vinil Branco Brilho', priceEffect: { addedPrice: 0 } },
          { value: 'vinil_fosco', label: 'Vinil Branco Fosco', priceEffect: { addedPrice: 0 } },
          { value: 'transparente', label: 'Vinil Transparente Cristal', priceEffect: { addedPrice: 10.00 } },
        ],
      },
    ],
    pricing_rules: [
      {
        id: 'rule-adesivo-default',
        service_id: 'srv-adesivos-vinil',
        name: 'Tabela Adesivos',
        price_per_page: 25.00,
        fallback_behavior: 'use_base',
        is_active: true,
        attributes: [],
      },
    ],
  },
];

export interface DefaultCategoryData {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
}

export interface DefaultProductData {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string | null;
  price: number;
  category_id: string;
}

export const DEFAULT_CATEGORIES: DefaultCategoryData[] = [
  { id: 'cat-papeis', name: 'Papéis e Envelopes', slug: 'papeis-envelopes', image_url: null },
  { id: 'cat-escrita', name: 'Escrita e Correção', slug: 'escrita-correcao', image_url: null },
  { id: 'cat-arquivo', name: 'Organização e Arquivo', slug: 'organizacao-arquivo', image_url: null },
  { id: 'cat-impressos', name: 'Impressos e Gráfica', slug: 'impressos-grafica', image_url: null },
  { id: 'cat-embalagens', name: 'Embalagens e Envio', slug: 'embalagens-envio', image_url: null },
  { id: 'cat-informatica', name: 'Informática e Cabos', slug: 'informatica-acessorios', image_url: null },
];

export const DEFAULT_PRODUCTS: DefaultProductData[] = [
  {
    id: 'prod-resma-a4',
    name: 'Resma de Papel Chamex A4 75g (500 folhas)',
    slug: 'resma-papel-a4-chamex',
    description: 'Papel sulfite alcalino de alta brancura e desempenho superior para impressoras laser e jato de tinta.',
    image_url: null,
    price: 28.90,
    category_id: 'cat-papeis',
  },
  {
    id: 'prod-caderno-10m',
    name: 'Caderno Universitário Espiral 10 Matérias (200 Fls)',
    slug: 'caderno-espiral-10-materias',
    description: 'Capa dura resistente, bolsa plástica interna, cartela de adesivos e folhas pautadas decoradas.',
    image_url: null,
    price: 24.50,
    category_id: 'cat-arquivo',
  },
  {
    id: 'prod-caneta-bic',
    name: 'Caneta Esferográfica BIC Cristal 1.0mm Azul (Kit 4un)',
    slug: 'caneta-bic-cristal-azul',
    description: 'A clássica caneta esferográfica de escrita macia e durabilidade incomparável.',
    image_url: null,
    price: 8.90,
    category_id: 'cat-escrita',
  },
  {
    id: 'prod-pasta-canaleta',
    name: 'Pasta com Canaleta A4 Transparente (Pacote com 5)',
    slug: 'pasta-canaleta-a4',
    description: 'Ideal para encadernar trabalhos escolares, relatórios e apresentações sem furar as folhas.',
    image_url: null,
    price: 12.50,
    category_id: 'cat-arquivo',
  },
  {
    id: 'prod-grampeador-mesa',
    name: 'Grampeador de Mesa Metálico Médio 26/6',
    slug: 'grampeador-mesa-26-6',
    description: 'Estrutura reforçada em aço para até 25 folhas com base emborrachada antideslizante.',
    image_url: null,
    price: 22.00,
    category_id: 'cat-escrita',
  },
  {
    id: 'prod-fita-adesiva',
    name: 'Fita Adesiva Transparente 45mm x 45m',
    slug: 'fita-adesiva-45mm-45m',
    description: 'Fita adesiva de alta aderência para fechamento de caixas e pacotes de envio.',
    image_url: null,
    price: 6.50,
    category_id: 'cat-embalagens',
  },
];
