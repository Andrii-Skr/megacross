import { z } from "@/lib/zodClient";

export const definitionSuggestionsSchema = z.object({
  texts: z.array(z.string().trim().min(1)).min(1).max(3),
  selected: z.array(z.string()),
});

export type DefinitionSuggestions = z.infer<typeof definitionSuggestionsSchema>;

export const generatedDefinitionsResponseSchema = definitionSuggestionsSchema.pick({ texts: true }).extend({
  success: z.literal(true),
});
