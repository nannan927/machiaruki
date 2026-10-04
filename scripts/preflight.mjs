import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const problems = [];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
try { if (!url || new URL(url).protocol !== "https:") problems.push("Supabase URL must be an HTTPS URL."); } catch { problems.push("Supabase URL is invalid."); }
if (!key || /YOUR_|test-public|your_supabase/.test(key)) problems.push("A real public Supabase key is required.");
if (key?.startsWith("sb_secret_")) problems.push("Never expose a Supabase secret key in NEXT_PUBLIC variables.");
try { if (key?.split(".").length === 3 && JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role === "service_role") problems.push("Never expose a service_role key in NEXT_PUBLIC variables."); } catch { problems.push("Supabase JWT key is malformed."); }
if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_ENABLED === "true") {
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) problems.push("Maps is enabled but its key is missing.");
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID === "DEMO_MAP_ID") problems.push("Use a production Map ID before enabling Maps in production.");
  console.log("Maps is enabled: verify domain restrictions and quota in Google Cloud before publishing.");
} else console.log("Maps is disabled: no map loads are initiated by the application.");
for (const problem of problems) console.error(problem);
console.log("Configuration values were not printed. This check does not contact external services or verify remote setup.");
if (problems.length) process.exitCode = 1;
