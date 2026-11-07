import crypto from "node:crypto";
import { UnauthorizedError } from "@agentforge/shared";

export interface JwtClaims {
  sub: string;
  email?: string;
  name?: string;
  exp?: number;
  nbf?: number;
  iss?: string;
  aud?: string | string[];
  [key: string]: unknown;
}

export interface JwtVerifyOptions {
  secret?: string;
  publicKey?: string;
  issuer?: string;
  audience?: string;
  algorithms?: string[];
}

export function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

export function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function verifyJwt(
  token: string,
  options: JwtVerifyOptions = {},
): JwtClaims {
  if (!token || typeof token !== "string") {
    throw new UnauthorizedError("Missing or malformed authentication token");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new UnauthorizedError(
      "Malformed JWT structure: token must have 3 segments",
    );
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  let header: { alg: string; typ?: string };
  let payload: JwtClaims;

  try {
    header = JSON.parse(base64UrlDecode(encodedHeader));
  } catch {
    throw new UnauthorizedError("Invalid JWT header: failed to parse JSON");
  }

  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    throw new UnauthorizedError("Invalid JWT payload: failed to parse JSON");
  }

  if (!header.alg) {
    throw new UnauthorizedError("JWT header missing algorithm parameter (alg)");
  }

  const allowedAlgs = options.algorithms || ["HS256", "RS256"];
  if (!allowedAlgs.includes(header.alg)) {
    throw new UnauthorizedError(`Unsupported signing algorithm: ${header.alg}`);
  }

  const message = `${encodedHeader}.${encodedPayload}`;

  if (header.alg === "HS256") {
    const secret =
      options.secret ||
      process.env.CLERK_SECRET_KEY ||
      process.env.JWT_SECRET ||
      "fallback-secret-for-dev";

    const expectedSignature = base64UrlEncode(
      crypto.createHmac("sha256", secret).update(message).digest(),
    );

    const sigA = Buffer.from(encodedSignature);
    const sigB = Buffer.from(expectedSignature);

    if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
      throw new UnauthorizedError(
        "Invalid cryptographic token signature: signature verification failed",
      );
    }
  } else if (header.alg === "RS256") {
    const publicKey =
      options.publicKey ||
      process.env.CLERK_PEM_PUBLIC_KEY ||
      process.env.JWT_PUBLIC_KEY;
    if (!publicKey) {
      throw new UnauthorizedError(
        "Public key not configured for RS256 token verification",
      );
    }

    try {
      const verifier = crypto.createVerify("RSA-SHA256");
      verifier.update(message);
      const signatureBuffer = Buffer.from(
        encodedSignature.replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      );
      const valid = verifier.verify(publicKey, signatureBuffer);
      if (!valid) {
        throw new UnauthorizedError(
          "Invalid cryptographic token signature: RSA verification failed",
        );
      }
    } catch (err: any) {
      throw new UnauthorizedError(
        `Cryptographic verification error: ${err.message}`,
      );
    }
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number") {
    if (payload.exp < now) {
      throw new UnauthorizedError(
        `Token expired at ${new Date(payload.exp * 1000).toISOString()}`,
      );
    }
  }

  // Check Not Before
  if (typeof payload.nbf === "number") {
    if (payload.nbf > now) {
      throw new UnauthorizedError(
        `Token not active until ${new Date(payload.nbf * 1000).toISOString()}`,
      );
    }
  }

  if (!payload.sub) {
    throw new UnauthorizedError(
      "Token payload missing subject identifier (sub)",
    );
  }

  return payload;
}

/**
 * Generates a signed JWT for testing or token creation.
 */
export function createSignedJwt(
  claims: Partial<JwtClaims> & { sub: string },
  secret: string,
  options: { expiresInSeconds?: number; alg?: "HS256" } = {},
): string {
  const alg = options.alg || "HS256";
  const header = { alg, typ: "JWT" };

  const now = Math.floor(Date.now() / 1000);
  const payload: JwtClaims = {
    ...claims,
    iat: now,
    exp:
      claims.exp ??
      (options.expiresInSeconds ? now + options.expiresInSeconds : now + 3600),
  };

  const encodedHeader = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const message = `${encodedHeader}.${encodedPayload}`;

  const signature = base64UrlEncode(
    crypto.createHmac("sha256", secret).update(message).digest(),
  );

  return `${message}.${signature}`;
}
