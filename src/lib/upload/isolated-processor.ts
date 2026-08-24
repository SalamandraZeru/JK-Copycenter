import path from 'path';
import type { FileType, PageCountMethod } from '@/types';
import { processFileInWorkerd } from './workerd-processor';

export interface IsolatedProcessingLimits {
  timeoutMs: number;
  memoryMb: number;
  maxInputBytes: number;
  maxEntries: number;
  maxDepth: number;
  maxUncompressedBytes: number;
  maxCompressionRatio: number;
  maxEntryBytes: number;
  maxImagePixels: number;
  maxConcurrentWorkers: number;
}

export interface IsolatedProcessingResult {
  pageCount: number;
  pageCountMethod: PageCountMethod;
  detectedMime: string;
  fileType: FileType;
  isSuspicious: boolean;
  metadata: Record<string, string | number | boolean>;
}

export async function processFileIsolated(
  buffer: Buffer,
  fileType: FileType,
  canonicalMime: string,
  limits: IsolatedProcessingLimits,
): Promise<IsolatedProcessingResult> {
  if (isCloudflareWorkerRuntime()) {
    if (activeWorkers >= limits.maxConcurrentWorkers) {
      throw new Error('PROCESSING_CAPACITY_EXCEEDED');
    }
    activeWorkers += 1;
    try {
      return await processFileInWorkerd(buffer, fileType, canonicalMime, limits);
    } finally {
      activeWorkers -= 1;
    }
  }
  if (activeWorkers >= limits.maxConcurrentWorkers) {
    throw new Error('PROCESSING_CAPACITY_EXCEEDED');
  }
  activeWorkers += 1;
  const { spawn } = await import('node:child_process');
  const workerPath = path.join(process.cwd(), 'scripts', 'file-processor-worker.cjs');
  const workerOptions = JSON.stringify({ ...limits, fileType, canonicalMime });
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [`--max-old-space-size=${limits.memoryMb}`, workerPath, workerOptions],
      {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        env: {
          NODE_ENV: process.env.NODE_ENV || 'production',
          PATH: process.env.PATH || '',
          SystemRoot: process.env.SystemRoot || '',
          TEMP: process.env.TEMP || '',
          TMP: process.env.TMP || '',
        },
      },
    );
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;
    const finish = (error?: Error, result?: IsolatedProcessingResult) => {
      if (settled) return;
      settled = true;
      activeWorkers -= 1;
      clearTimeout(timer);
      if (error) reject(error);
      else if (result) resolve(result);
      else reject(new Error('PROCESSING_FAILED'));
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error('PROCESSING_TIMEOUT'));
    }, limits.timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > 64 * 1024) {
        child.kill('SIGKILL');
        finish(new Error('PROCESSOR_OUTPUT_LIMIT'));
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (Buffer.concat(stderr).length < 4096) stderr.push(chunk.subarray(0, 4096));
    });
    child.on('error', (error) => finish(error));
    child.on('close', (code) => {
      if (settled) return;
      if (code !== 0) {
        const message = Buffer.concat(stderr).toString('utf8').trim() || 'PROCESSING_FAILED';
        finish(new Error(message));
        return;
      }
      try {
        finish(undefined, JSON.parse(Buffer.concat(stdout).toString('utf8')) as IsolatedProcessingResult);
      } catch {
        finish(new Error('PROCESSOR_INVALID_OUTPUT'));
      }
    });
    child.stdin.on('error', (error) => finish(error));
    child.stdin.end(buffer);
  });
}

let activeWorkers = 0;

function isCloudflareWorkerRuntime(): boolean {
  const workerGlobal = globalThis as typeof globalThis & { EdgeRuntime?: unknown; WebSocketPair?: unknown };
  return Boolean(process.versions?.workerd)
    || typeof workerGlobal.WebSocketPair !== 'undefined'
    || typeof workerGlobal.EdgeRuntime !== 'undefined'
    || workerGlobal.navigator?.userAgent.includes('Cloudflare') === true;
}
