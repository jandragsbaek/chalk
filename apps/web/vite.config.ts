import { ADMIN_API_PREFIX, RPC_PATH } from "@chalk/contracts";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

const server = `http://127.0.0.1:${process.env.CHALK_PORT ?? "4300"}`;

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react({ compiler: true }),
    tailwindcss(),
  ],
  server: {
    port: Number(process.env.PORT ?? 5173),
    // Single origin in dev, as in production: Vite forwards the app RPC and the admin API.
    proxy: { [RPC_PATH]: server, [ADMIN_API_PREFIX]: server },
  },
});
