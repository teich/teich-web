import { defineConfig } from "cf/config";

export default defineConfig({
  accountId: "02bd603968db4f77d62a3c447ee329a2",
  worker: {
    name: "teich-web",
    compatibilityDate: "2026-11-27",
    workersDev: false,
    domains: ["teich.net"],
    assets: {
      htmlHandling: "auto-trailing-slash",
      notFoundHandling: "404-page",
    },
  },
});
