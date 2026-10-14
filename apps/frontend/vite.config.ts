import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(() => {
  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    build: {
      target: "es2015",
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                debugName: "vendor packages",
                test: /node_modules[\\/]/,
                name: (moduleId) => {
                  const packagePath = moduleId
                    .replace(/\\/g, "/")
                    .split("/node_modules/")
                    .at(-1);
                  if (!packagePath) {
                    return null;
                  }

                  const [first, second] = packagePath.split("/");
                  const packageName = first.startsWith("@")
                    ? `${first}-${second}`
                    : first;
                  return `vendor-${packageName.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
                },
                minSize: 20 * 1024,
                maxSize: 450 * 1024,
              },
            ],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      coverage: {
        provider: "v8",
        reporter: ["text", "lcov"],
        exclude: ["node_modules/", "src/test/"],
      },
    },
  };
});
