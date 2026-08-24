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

const previewSchema = z.object({
  serviceId: z.string().uuid(),
  attributeIds: z.array(z.string().uuid()).max(100).default([]),
  fieldValues: z.array(z.object({
    fieldKey: z.string().trim().min(1).max(100),
    value: z.union([z.string().max(5_000), z.number().finite(), z.boolean()]),
  })).max(100).default([]),
  fileIds: z.array(z.string().uuid()).max(100).default([]),
  pageCount: z.number().int().optional(),
  isFrontAndBack: z.boolean().default(false),
  quantity: z.number().int().min(1).max(100_000_000),
});

// Simple in-memory rate limiting mock
const rateLimitCache = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const userRecord = rateLimitCache.get(ip);

  if (!userRecord) {
    rateLimitCache.set(ip, { count: 1, timestamp: now });
    return true;
  }

  if (now - userRecord.timestamp > RATE_LIMIT_WINDOW) {
    rateLimitCache.set(ip, { count: 1, timestamp: now });
    return true;
  }

  if (userRecord.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  userRecord.count++;
  return true;
}

export async function POST(req: NextRequest): Promise<NextResponse<PricingResult>> {
  try {
    if (!validateCsrfOrigin(req.headers.get('origin'), req.headers.get('host'))) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Requisição não autorizada.' },
      }, { status: 403 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(',')[0]?.trim() || "unknown-ip";
    if (!checkRateLimit(ip)) {
      const result: PricingResult = {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "Too many requests. Please try again later.",
        },
      };
      return NextResponse.json(result, { status: 429 });
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
    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    const guestSession = user ? null : readGuestUploadSession(req);

    let pageCount = 1;
    let isEstimate = false;
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
    }

    const result = await validateAndRecalculate({
      serviceId: intent.serviceId,
      attributeIds: intent.attributeIds,
      fieldValues: intent.fieldValues,
      pageCount,
      isFrontAndBack: intent.isFrontAndBack,
      quantity: intent.quantity,
      fileIds: intent.fileIds,
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
