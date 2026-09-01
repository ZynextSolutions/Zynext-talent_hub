import {
  defineRailway,
  fn,
  github,
  group,
  image,
  postgres,
  preserve,
  project,
  redis,
  service,
  volume,
} from "railway/iac";

const REPO = "ZynextSolutions/Zynext-talent_hub";

const JOB_PATHS = [
  "reminders",
  "recertify",
  "scheduled-reports",
  "cert-expiry",
  "analytics-snapshots",
] as const;

function cronStartCommand(): string {
  const calls = JOB_PATHS.map(
    (path) =>
      `curl -fsS -X POST "$BASE/${path}?organizationId=$ORGANIZATION_ID" -H "X-Job-Secret: $JOB_SECRET"`,
  ).join("; echo; ");
  return `set -eu; BASE="http://$API_HOST:$API_PORT/api/v1/jobs"; ${calls}; echo "[cron] done"`;
}

export default defineRailway(() => {
  const db = postgres("Postgres");
  const cache = redis("Redis");
  const uploads = volume("uploads", { sizeMB: 5120 });

  const api = service("api", {
    source: github(REPO),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "backend/Dockerfile",
      watchPatterns: [
        "backend/**",
        "prisma/**",
        "package.json",
        "package-lock.json",
        "backend/Dockerfile",
      ],
    },
    healthcheck: "/ready",
    healthcheckTimeout: 300,
    replicas: 1,
    deploy: {
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 5,
    },
    volumeMounts: {
      "/app/uploads": uploads,
    },
    env: {
      NODE_ENV: "production",
      // Must be an explicit service variable so ${{api.PORT}} resolves for web/jobs.
      // Railway's runtime-injected PORT is NOT referenceable across services.
      PORT: "4000",
      RAILWAY_DOCKERFILE_PATH: "backend/Dockerfile",
      DATABASE_URL: db.env.DATABASE_URL,
      REDIS_URL: cache.env.REDIS_URL,
      JWT_ISS: "cor-lms",
      JWT_AUD: "cor-lms-api",
      BCRYPT_ROUNDS: "12",
      ALLOW_PUBLIC_ORG_REGISTER: "false",
      ALLOW_QUERY_ACCESS_TOKEN: "false",
      LISTEN_HOST: "::",
      JWT_ACCESS_SECRET: preserve(),
      JWT_REFRESH_SECRET: preserve(),
      JOB_SECRET: preserve(),
      ENCRYPTION_KEY: preserve(),
      SENTRY_DSN: preserve(),
      SMTP_HOST: preserve(),
      SMTP_PORT: preserve(),
      SMTP_USER: preserve(),
      SMTP_PASS: preserve(),
      SMTP_FROM: preserve(),
      CORS_ORIGINS: "https://${{web.RAILWAY_PUBLIC_DOMAIN}}",
      PUBLIC_WEB_URL: "https://${{web.RAILWAY_PUBLIC_DOMAIN}}",
      API_PUBLIC_URL: "https://${{web.RAILWAY_PUBLIC_DOMAIN}}",
    },
  });

  const web = service("web", {
    source: github(REPO),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "frontend/Dockerfile",
      watchPatterns: ["frontend/**", "frontend/Dockerfile"],
    },
    healthcheck: "/health",
    healthcheckTimeout: 120,
    replicas: 1,
    deploy: {
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 5,
    },
    env: {
      NODE_ENV: "production",
      RAILWAY_DOCKERFILE_PATH: "frontend/Dockerfile",
      NEXT_PUBLIC_API_URL: "/api/v1",
      NEXT_PUBLIC_WEB_URL: "https://${{web.RAILWAY_PUBLIC_DOMAIN}}",
      NODE_OPTIONS: "--dns-result-order=ipv6first",
      // Prefer private DNS; also expose host/port for the proxy fallback constructor.
      API_PROXY_TARGET: "http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}",
      API_HOST: "${{api.RAILWAY_PRIVATE_DOMAIN}}",
      API_PORT: "${{api.PORT}}",
    },
  });

  const jobs = fn("jobs", {
    source: image("curlimages/curl:8.12.1"),
    deploy: {
      cronSchedule: "0 2 * * *",
      restartPolicyType: "NEVER",
      startCommand: cronStartCommand(),
    },
    env: {
      JOB_SECRET: preserve(),
      ORGANIZATION_ID: preserve(),
      API_HOST: "${{api.RAILWAY_PRIVATE_DOMAIN}}",
      API_PORT: "${{api.PORT}}",
    },
  });

  return project("Zynext TalentHub", {
    resources: [
      ...group("Data", [db, cache, uploads]),
      ...group("App", [api, web, jobs]),
    ],
  });
});
