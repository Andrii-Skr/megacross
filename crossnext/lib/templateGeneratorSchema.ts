import { z } from "zod";

const pictureSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("auto"), count: z.number().int().min(0).max(20) }),
  z.object({
    mode: z.literal("manual"),
    items: z.array(z.object({ width: z.number().int().min(4), height: z.number().int().min(4) })).max(20),
  }),
]);

export const templateGenerationSchema = z.object({
  rows: z.number().int().min(5).max(40),
  cols: z.number().int().min(5).max(40),
  resultCount: z.number().int().min(1).max(150),
  dictionaryFilterId: z.number().int().positive().nullable().optional(),
  pictures: pictureSchema,
  cutoutPresetId: z.enum([
    "none",
    "corner",
    "opposite-corners",
    "edge-bite",
    "opposite-edge-bites",
    "stepped-corner",
    "center-window",
  ]),
  seed: z
    .union([z.string().max(128), z.number()])
    .nullable()
    .optional(),
});
