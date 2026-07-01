import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: {
    timeout: 7_000,
  },
  reporter: "list",
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --open=false",
    url: "http://127.0.0.1:5173/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://127.0.0.1:5173/",
    browserName: "chromium",
    trace: "on-first-retry",
    viewport: {
      width: 1280,
      height: 720,
    },
  },
});
