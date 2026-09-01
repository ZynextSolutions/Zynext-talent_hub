-- Full Postgres reset for Railway / production recovery (P3009).
-- Run in Railway → Postgres → Query (or psql connected to DATABASE_URL).
-- Then redeploy the api service (do NOT redeploy twice in parallel).

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Railway Postgres user is usually in DATABASE_URL (often "postgres").
-- If GRANT fails, skip these lines — schema drop/create is enough.
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
