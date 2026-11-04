export function buildPostgresUrl(input: {
  user: string;
  password?: string | null;
  host: string;
  port: string | number;
  database: string;
}): string;

export function buildPostgresUrlFromEnv(env?: Record<string, string | undefined>): string;
