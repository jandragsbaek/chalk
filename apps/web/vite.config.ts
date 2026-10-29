import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const serverPort = process.env.CHALK_PORT ?? "4300";

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react({ compiler: true }),
    tailwindcss(),
  ],
  server: {
    port: Number(process.env.PORT ?? 5173),
    // Single origin in dev: the browser only talks to Vite, which forwards RPC_PATH to the server.
    proxy: { "/rpc": `http://127.0.0.1:${serverPort}` },
  },
});
