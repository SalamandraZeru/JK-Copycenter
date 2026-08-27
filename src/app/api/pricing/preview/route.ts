import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { PricingResult } from "@/types/pricing";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { validateAndRecalculate } from "@/lib/pricing/checkout-validator";
import { validateCsrfOrigin } from '@/lib/security/csrf';
import { createClient } from '@/lib/supabase/server';
import { readGuestUploadSession } from '@/lib/upload/guest-session';
import { loadAuthorizedReadyFiles } from '@/lib/upload/access';
import { enforceCloudflareRateLimit } from '@/lib/security/cloudflare-rate-limit';
import { extractTrustedPdfDimensions } from '@/lib/upload/pdf-dimensions';

const previewSchema = z.object({
  serviceId: z.string().uuid(),
  attributeIds: z.array(z.string().uuid()).max(100).default([]),
  fieldValues: z.array(z.object({
    fieldKey: z.string().trim().min(1).max(100),
    value: z.union([z.string().max(5_000), z.number().finite(), z.boolean()]),
  })).max(100).default([]),
  fileIds: z.array(z.string().uuid()).max(100).default([]),
  bindingFileIds: z.array(z.string().uuid()).max(100).default([]),
  dimensions: z.object({
    widthCm: z.number().finite().positive().max(100_000).optional(),
    heightCm: z.number().finite().positive().max(100_000).optional(),
    lengthCm: z.number().finite().positive().max(100_000).optional(),
  }).default({}),
  bookletPaddingApproved: z.boolean().default(false),
  pageCount: z.number().int().optional(),
  isFrontAndBack: z.boolean().default(false),
  quantity: z.number().int().min(1).max(100_000_000),
});

export async function POST(req: NextRequest): Promise<NextResponse<PricingResult>> {
  try {
    if (!validateCsrfOrigin(req.headers.get('origin'), req.headers.get('host'))) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Requisição não autorizada.' },
      }, { status: 403 });
    }

    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    const guestSession = user ? null : readGuestUploadSession(req);
    const limit = await enforceCloudflareRateLimit(
      req,
      'JK_PRICING_PREVIEW_RATE_LIMIT',
      'pricing-preview',
      { userId: user?.id ?? null, guestSessionHash: guestSession?.hash ?? null },
    );
    if (!limit.allowed) {
      const result: PricingResult = {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "Muitas requisições. Tente novamente em instantes.",
        },
      };
      return NextResponse.json(result, {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfterSeconds) },
      });
    }

    const body = (await req.json()) as unknown;
    const parseResult = previewSchema.safeParse(body);

    if (!parseResult.success) {
      const result: PricingResult = {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: `Invalid input: ${parseResult.error.message}`,
        },
      };
      return NextResponse.json(result, { status: 400 });
    }

    const intent = parseResult.data;
    const supabaseAdmin = createServiceRoleClient();
    let pageCount = 1;
    let isEstimate = false;
    let bindingFiles: Array<{ fileId: string; pageCount: number }> = [];
    let trustedPdfDimensions: Array<{ fileId: string; widthCm: number; heightCm: number }> = [];
    if (intent.fileIds.length > 0) {
      let files;
      try {
        const owner = user
          ? { userId: user.id }
          : { guestUploadSessionHash: guestSession?.hash || '' };
        files = await loadAuthorizedReadyFiles(supabaseAdmin, intent.fileIds, owner);
      } catch {
        return NextResponse.json({
          success: false,
          error: { code: 'QUOTE_UNAVAILABLE', message: 'Metadados de arquivo indisponíveis.' },
        }, { status: 400 });
      }
      pageCount = files.reduce((sum, file) => sum + Math.max(1, file.page_count), 0);
      isEstimate = files.some((file) => file.page_count_method !== 'exact');
      const filesById = new Map(files.map((file) => [file.id, file]));
      if (new Set(intent.bindingFileIds).size !== intent.bindingFileIds.length
          || intent.bindingFileIds.some((fileId) => !filesById.has(fileId))) {
        return NextResponse.json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Arquivo de encadernação inválido.' },
        }, { status: 400 });
      }
      bindingFiles = intent.bindingFileIds.map((fileId) => ({
        fileId,
        pageCount: Math.max(1, filesById.get(fileId)!.page_count),
      }));
      trustedPdfDimensions = extractTrustedPdfDimensions(files);
    } else if (intent.bindingFileIds.length > 0) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Selecione arquivos enviados para encadernação.' },
      }, { status: 400 });
    }

    const result = await validateAndRecalculate({
      serviceId: intent.serviceId,
      attributeIds: intent.attributeIds,
      fieldValues: intent.fieldValues,
      pageCount,
      isFrontAndBack: intent.isFrontAndBack,
      quantity: intent.quantity,
      fileIds: intent.fileIds,
      bindingFileIds: intent.bindingFileIds,
      bindingFiles,
      uploadedPdfDimensions: trustedPdfDimensions,
      dimensions: intent.dimensions,
      bookletPaddingApproved: intent.bookletPaddingApproved,
    }, supabaseAdmin);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    result.data.isEstimate = isEstimate;

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const result: PricingResult = {
      success: false,
      error: {
        code: "INVALID_INPUT",
        message: error instanceof Error ? error.message : "An unexpected error occurred.",
      },
    };
    return NextResponse.json(result, { status: 500 });
  }
}
