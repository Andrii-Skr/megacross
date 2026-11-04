export function buildPostgresUrl({ user, password, host, port, database }) {
  const address = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  const auth = password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}` : encodeURIComponent(user);
  return `postgresql://${auth}@${address}:${port}/${encodeURIComponent(database)}?schema=public`;
}

export function buildPostgresUrlFromEnv(env = process.env) {
  return buildPostgresUrl({
    user: env.POSTGRES_USER || "app",
    password: env.POSTGRES_PASSWORD || "",
    host: env.POSTGRES_HOST || "db",
    port: env.POSTGRES_PORT || "5432",
    database: env.POSTGRES_DB || "app",
  });
}
