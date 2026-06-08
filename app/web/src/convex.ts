import { ConvexReactClient } from "convex/react";

const url = import.meta.env.VITE_CONVEX_URL;

if (!url) {
  throw new Error(
    "VITE_CONVEX_URL is not set. Copy app/web/.env.example to .env.local and fill it in.",
  );
}

export const convex = new ConvexReactClient(url);
