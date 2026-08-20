import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const securityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "0" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const withNextIntl = createNextIntlPlugin("./i18n.ts");
const projectRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(projectRoot, "..");
const tailwindcssPath = fileURLToPath(new URL("./node_modules/tailwindcss", import.meta.url));

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.228"],
  turbopack: {
    // pnpm stores the real Next.js package under the workspace-level .pnpm store.
    root: workspaceRoot,
    resolveAlias: {
      tailwindcss: tailwindcssPath,
    },
  },
  outputFileTracingRoot: workspaceRoot,
  // Produce a minimal standalone server output for Docker runner stage
  output: "standalone",
  // Sharp loads its platform binary and libvips through optional @img packages.
  // Their native files are not always discovered by standalone output tracing.
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/.pnpm/@img+sharp-*/node_modules/@img/sharp-*/**/*",
      "./node_modules/.pnpm/@img+sharp-libvips-*/node_modules/@img/sharp-libvips-*/**/*",
    ],
  },
  serverExternalPackages: ["sharp"],
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
  ],
  experimental: {
    optimizePackageImports: ["lucide-react", "@tanstack/react-query", "sonner", "next-intl"],
  },
  transpilePackages: ["@megacross/cross-clues"],
};

export default withNextIntl(nextConfig);
