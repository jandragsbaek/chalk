import { ADMIN_API_PREFIX } from "@chalk/contracts";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

const adminPort = process.env.CHALK_ADMIN_PORT ?? "4301";

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react({ compiler: true }),
    tailwindcss(),
  ],
  server: {
    port: Number(process.env.PORT ?? 5174),
    // Single origin in dev, as in production: Vite forwards the admin API to the server's admin mode.
    proxy: { [ADMIN_API_PREFIX]: `http://127.0.0.1:${adminPort}` },
  },
});
