import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  use: { baseURL: "http://localhost:3100", headless: true },
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    env: { NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED ?? "true", NEXT_PUBLIC_ALLOW_SIGNUP: process.env.NEXT_PUBLIC_ALLOW_SIGNUP ?? "true", NEXT_PUBLIC_SUPABASE_URL: "https://test-project.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-public-key", NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "test-key-never-send-to-google", NEXT_PUBLIC_GOOGLE_MAPS_ENABLED: "true" },
  },
});
