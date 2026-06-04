import {
  type CompareResult as CompareResultBase,
  compareWithPrepared as compareWithPreparedBase,
  type ExistingDef,
  type Lang,
  type NewDef,
  type Options,
  type PreparedExisting,
  prepareExisting as prepareExistingBase,
  type ResultItem,
} from "@/lib/similarityClient";

export type { ExistingDef, Lang, NewDef, Options, PreparedExisting, ResultItem };

export type CompareInput = {
  word: string;
  newDefinition: NewDef;
  existing: ExistingDef[];
  options?: Options;
};

export type CompareResult = CompareResultBase & {
  stats: { comparedCount: number; elapsedMs: number };
};

export function prepareExisting(existing: ExistingDef[], options?: Options): PreparedExisting {
  return prepareExistingBase(existing, options);
}

export function compareWithPrepared(newDef: NewDef, prepared: PreparedExisting, options?: Options): CompareResult {
  const start = performance.now();
  const result = compareWithPreparedBase(newDef, prepared, options);
  const elapsedMs = performance.now() - start;

  return {
    ...result,
    stats: {
      comparedCount: prepared.length,
      elapsedMs,
    },
  };
}

export function compareDefinitions(input: CompareInput): CompareResult {
  const prepared = prepareExisting(input.existing, input.options);
  return compareWithPrepared(input.newDefinition, prepared, input.options);
}
