// @ts-check
import { defineConfig } from "astro/config";

// Served at https://obiverse.github.io/shop/ from the gh-pages branch of obiverse/shop.
export default defineConfig({
  site: "https://obiverse.github.io",
  base: "/shop",
  trailingSlash: "always",
  build: { format: "directory" },
  image: { responsiveStyles: true },
});
