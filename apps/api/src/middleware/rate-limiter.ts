import { Request, Response, NextFunction } from "express";
import { rateLimitExceededTotal } from "@agentforge/shared";

export interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  capacity?: number;
  refillRatePerSec?: number;
  keyGenerator?: (req: Request) => string;
}

interface TokenBucket {
  tokens: number;
  capacity: number;
  refillRatePerSec: number;
  lastRefillTime: number;
}

export class TokenBucketRateLimiter {
  private buckets = new Map<string, TokenBucket>();
  private defaultCapacity: number;
  private defaultRefillRatePerSec: number;
  private keyGenerator: (req: Request) => string;

  constructor(options: RateLimitOptions = {}) {
    const windowMs = options.windowMs ?? 60 * 1000;
    const maxRequests = options.maxRequests ?? 100;

    // If explicit capacity/refillRate given use them, else derive from windowMs/maxRequests
    this.defaultCapacity = options.capacity ?? maxRequests;
    this.defaultRefillRatePerSec =
      options.refillRatePerSec ?? maxRequests / (windowMs / 1000);

    this.keyGenerator =
      options.keyGenerator ??
      ((req: Request): string => {
        // Multi-tenant isolation: prioritize workspace header, then query or IP
        const workspaceId =
          req.headers["x-workspace-id"] ||
          (req as any).workspaceId ||
          (req as any).user?.workspaceId ||
          req.query.workspaceId;

        if (workspaceId && typeof workspaceId === "string") {
          return `ws:${workspaceId}`;
        }

        const ip = req.ip || req.socket.remoteAddress || "unknown-client";
        return `ip:${ip}`;
      });

    // Clean up stale buckets every 5 minutes to avoid memory leaks
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of this.buckets.entries()) {
        const idleSeconds = (now - bucket.lastRefillTime) / 1000;
        if (bucket.tokens >= bucket.capacity && idleSeconds > 300) {
          this.buckets.delete(key);
        }
      }
    }, 300000);

    if (cleanupInterval.unref) {
      cleanupInterval.unref();
    }
  }

  public getBucket(key: string): TokenBucket {
    let bucket = this.buckets.get(key);
    const now = Date.now();
    if (!bucket) {
      bucket = {
        tokens: this.defaultCapacity,
        capacity: this.defaultCapacity,
        refillRatePerSec: this.defaultRefillRatePerSec,
        lastRefillTime: now,
      };
      this.buckets.set(key, bucket);
    } else {
      // Refill tokens based on elapsed time
      const elapsedSeconds = (now - bucket.lastRefillTime) / 1000;
      if (elapsedSeconds > 0) {
        bucket.tokens = Math.min(
          bucket.capacity,
          bucket.tokens + elapsedSeconds * bucket.refillRatePerSec,
        );
        bucket.lastRefillTime = now;
      }
    }
    return bucket;
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const clientKey = this.keyGenerator(req);
      const bucket = this.getBucket(clientKey);

      const capacity = Math.floor(bucket.capacity);
      const resetSeconds =
        bucket.tokens < 1
          ? Math.ceil((1 - bucket.tokens) / bucket.refillRatePerSec)
          : 1;

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        const remaining = Math.max(0, Math.floor(bucket.tokens));

        res.setHeader("X-RateLimit-Limit", capacity);
        res.setHeader("X-RateLimit-Remaining", remaining);
        res.setHeader("X-RateLimit-Reset", resetSeconds);
        res.setHeader("X-RateLimit-Scope", clientKey);
        next();
      } else {
        rateLimitExceededTotal.inc({
          scope: clientKey.startsWith("ws:") ? "workspace" : "ip",
        });

        res.setHeader("X-RateLimit-Limit", capacity);
        res.setHeader("X-RateLimit-Remaining", 0);
        res.setHeader("X-RateLimit-Reset", resetSeconds);
        res.setHeader("X-RateLimit-Scope", clientKey);

        res.status(429).json({
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: `Too many requests. Limit is ${capacity} requests burst capacity for scope ${clientKey}. Please retry in ${resetSeconds}s.`,
            details: {
              retryAfterSeconds: resetSeconds,
              scope: clientKey,
            },
            requestId: req.id || "unknown",
          },
        });
      }
    };
  }

  public reset(): void {
    this.buckets.clear();
  }
}

export function createRateLimiter(options: RateLimitOptions = {}) {
  const limiter = new TokenBucketRateLimiter(options);
  return limiter.middleware();
}
