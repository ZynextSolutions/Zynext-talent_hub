import {
  defineRailway,
  github,
  group,
  postgres,
  preserve,
  project,
  redis,
  service,
  volume,
} from "railway/iac";

const REPO = "ZynextSolutions/Zynext-talent_hub";

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
      PORT: "4000",
      RAILWAY_DOCKERFILE_PATH: "backend/Dockerfile",
      DATABASE_URL: db.env.DATABASE_URL,
      REDIS_URL: cache.env.REDIS_URL,
      JWT_ISS: "cor-lms",
      JWT_AUD: "cor-lms-api",
      BCRYPT_ROUNDS: "12",
      ALLOW_PUBLIC_ORG_REGISTER: "false",
      ALLOW_QUERY_ACCESS_TOKEN: "false",
      JWT_ACCESS_SECRET: preserve(),
      JWT_REFRESH_SECRET: preserve(),
      JOB_SECRET: preserve(),
      ENCRYPTION_KEY: preserve(),
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
      API_PROXY_TARGET: "http://${{api.RAILWAY_PRIVATE_DOMAIN}}:4000",
    },
  });

  return project("Zynext TalentHub", {
    resources: [...group("Data", [db, cache, uploads]), ...group("App", [api, web])],
  });
});
