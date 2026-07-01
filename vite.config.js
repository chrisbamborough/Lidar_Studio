import { defineConfig } from "vite";

const proxyTarget = process.env.RECORD3D_PROXY_TARGET;

export default defineConfig({
  server: {
    open: "/",
    port: Number(process.env.PORT || 5173),
    proxy: proxyTarget
      ? {
          "/webrtc": {
            target: proxyTarget,
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/webrtc/, ""),
          },
        }
      : undefined,
  },
});
