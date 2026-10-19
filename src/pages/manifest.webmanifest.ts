import { shop, href } from "../lib/shop";

export function GET() {
  return new Response(JSON.stringify({
    name: shop.name,
    short_name: shop.short,
    description: shop.tagline,
    id: href(),
    start_url: href(),
    scope: href(),
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: shop.background,
    theme_color: shop.background,
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: href("icons/192.png"), sizes: "192x192", type: "image/png" },
      { src: href("icons/512.png"), sizes: "512x512", type: "image/png" },
      { src: href("icons/maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Cart", url: href("cart/"), icons: [{ src: href("icons/192.png"), sizes: "192x192" }] },
      { name: "Rent", url: href("rent/"), icons: [{ src: href("icons/192.png"), sizes: "192x192" }] },
      { name: "Saved", url: href("saved/"), icons: [{ src: href("icons/192.png"), sizes: "192x192" }] },
    ],
  }), { headers: { "content-type": "application/manifest+json" } });
}
