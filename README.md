

# JK Copycenter

A full-stack web application built to manage the daily operations of the JK Copycenter print shop and stationery store. It handles everything from a public catalog and a dynamic service configurator to server-side pricing, file processing, WhatsApp-integrated checkout, and a dedicated admin panel for production management.

## Features

* **Service Configurator:** Admins can define custom print options, required fields, and rules for each service.
* **Server-Side Pricing:** The final price is calculated in the backend based on active rules, preventing any client-side tampering.
* **File Processing:** Upload support for PDF, DOCX, images, ZIP, and RAR. Includes file signature validation, isolated processing, and smart page-count estimation.
* **WhatsApp Checkout:** Idempotent checkout flow that registers the order in the database before redirecting the user to WhatsApp with a pre-formatted message.
* **Client Portal:** A PWA for customers to track orders, manage uploaded files, and update their profile.
* **Admin Dashboard:** Role-based access control (`super_admin`, `admin`, `producao`, `catalogo`) to manage the catalog, pricing, production queues, and audit logs.
* **Dual PWAs:** The public storefront and the `/admin/` area operate as two independent Progressive Web Apps.

## Tech Stack

* **Framework:** Next.js 16, React 19, TypeScript
* **Styling & UI:** Tailwind CSS, Lucide, React Hook Form, SWR, Recharts
* **Database & Auth:** Supabase (PostgreSQL, Auth, Storage, RLS)
* **Validation:** Zod
* **File Handling:** `pdf-lib`, `sharp`, `yauzl`, `node-unrar-js`
* **Hosting:** Cloudflare Workers (via OpenNext)
* **Quality & Testing:** Vitest, Playwright, ESLint

## Security

* Prices, discounts, and delivery fees are strictly calculated on the server.
* Idempotency keys are used to prevent duplicate orders during checkout.
* File uploads are verified by signature (not just extension), checked for path traversal, and processed in isolation.
* `SUPABASE_SERVICE_ROLE_KEY` is fully isolated in the backend and never exposed to the client.

## Local Development

You will need Node.js 20+, a Supabase project, and a Cloudflare account with Wrangler authenticated.

1. Install dependencies:
```bash
npm ci

```


2. Setup your environment variables:
```bash
cp .env.example .env.local

```


3. Fill in `.env.local` (never commit real credentials to the repo):
* `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
* `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public client key
* `SUPABASE_SERVICE_ROLE_KEY`: Private server key
* `NEXT_PUBLIC_SITE_URL`: Canonical store URL
* `CRON_SECRET`: Token for protected cron jobs


4. Start the development server:
```bash
npm run dev

```


The application will be available at `http://localhost:3000`.

## Database & Migrations

Migrations are kept in `supabase/migrations/` and must be versioned. To push them to your linked Supabase project:

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push

```

*Note: For Google OAuth, ensure your callback URLs are properly configured in Supabase. Admin login is restricted to email and password only.*

## Cloudflare Workers Deployment

Before deploying, make sure your code passes all quality checks:

```bash
npm run check
npm test
npm run build

```

To deploy to Cloudflare:

1. Apply migrations to your production database.
2. Add your environment variables to the Worker. **Important:** Set `SUPABASE_SERVICE_ROLE_KEY` as a secret.
3. Update `NEXT_PUBLIC_SITE_URL` and Supabase Auth redirect URLs to match your production domain.
4. Run the deploy command:
```bash
npm run deploy

```



## License

Proprietary code of JK Copycenter. All rights reserved.
