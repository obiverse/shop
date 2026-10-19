import { defineCollection, reference } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// A house is one merchant line (sandals, scents…). Each closes its own trades on its own WhatsApp.
const houses = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/content/houses" }),
  schema: ({ image }) => z.object({
    name: z.string(),
    tagline: z.string(),
    story: z.string(),
    whatsapp: z.string().regex(/^\+?[\d\s-]{8,}$/, "International format, e.g. +2348012345678"),
    currency: z.enum(["NGN", "USD", "GBP", "EUR", "GHS", "KES"]).default("NGN"),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    lineup: image().optional(), // transparent row of products for the home card
    lookbook: image().optional(), // the house flier
    // A house-wide, time-boxed offer, e.g. 15% off every slipper until 30 Nov. Products can override with their own `sale`.
    promo: z.object({ label: z.string().default("Sale"), percent: z.number().int().min(1).max(90), ends: z.coerce.date().optional() }).optional(),
    order: z.number().default(0),
  }),
});

const range = z.object({ from: z.coerce.date(), to: z.coerce.date(), qty: z.number().int().positive().optional() });

// One product = one folder: index.md + its photos (+ optional .glb from Blender).
const products = defineCollection({
  loader: glob({ pattern: "*/index.md", base: "./src/content/products", generateId: ({ entry }) => entry.split("/")[0] }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      house: reference("houses"),
      mode: z.enum(["buy", "rent"]).default("buy"),
      price: z.number().positive(), // major units; per day when renting
      // This product's own offer: a set price or a percent off, optionally ending on a date.
      sale: z.object({ price: z.number().positive().optional(), percent: z.number().int().min(1).max(90).optional(), ends: z.coerce.date().optional(), label: z.string().optional() }).optional(),
      badge: z.string().max(18).optional(), // "Bestseller", "New" — only if true
      summary: z.string().max(160),
      images: z.array(image()).min(1),
      model: z.string().optional(),
      options: z.array(z.object({ name: z.string(), values: z.array(z.coerce.string()).min(1) })).default([]),
      stock: z.enum(["in", "low", "made_to_order", "out"]).default("in"),
      lead_days: z.number().int().optional(),
      rent: z
        .object({
          deposit: z.number().min(0).default(0),
          min_days: z.number().int().min(1).default(1),
          units: z.number().int().positive().optional(), // how many exist, e.g. 300 chairs
          unit: z.string().default("item"), // what one is called, e.g. "chair"
          booked: z.array(range).default([]),
        })
        .optional(),
      tags: z.array(z.string()).default([]),
      featured: z.boolean().default(false),
      order: z.number().default(0),
      draft: z.boolean().default(false),
    }),
});

export const collections = { houses, products };
