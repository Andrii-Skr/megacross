export type Lang = "ru" | "uk" | "en";
export type DefinitionGenerationCount = 1 | 3 | 6;

export type GenerateInput = {
  word: string;
  language: Lang;
  existing: string[];
  avoid?: string[];
  maxLength: number;
  count?: DefinitionGenerationCount;
};

export type ProviderResult = { ok: true; text: string } | { ok: false; message: string; status?: number };
