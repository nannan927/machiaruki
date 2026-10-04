import { spawnSync } from "node:child_process";
// Override local credentials. Legacy Google flags deliberately stay enabled to catch regressions.
// Browser fixtures mock GSI/Supabase and reject every attempted Google request.
const env = {
  ...process.env,
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "test-key-never-send-to-google",
  NEXT_PUBLIC_GOOGLE_MAPS_ENABLED: "true",
  NEXT_PUBLIC_SUPABASE_URL: "https://test-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-public-key",
};
for (const name of ["lint", "typecheck", "test", "test:e2e", "build"]) {
  const result = spawnSync("npm", ["run", name], { stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
