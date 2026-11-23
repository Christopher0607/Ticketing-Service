import type { MetadataRoute } from "next";

// Lets buyers "install" the site to their home screen like an app, at no extra cost.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Crazy Monkey Ticketing",
    short_name: "Crazy Monkey",
    description: "Malaysia’s safe ticket resale marketplace · 马来西亚安心门票转让平台",
    start_url: "/",
    display: "standalone",
    background_color: "#090806",
    theme_color: "#090806",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/logo.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
