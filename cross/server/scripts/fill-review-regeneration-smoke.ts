import assert from "node:assert/strict";
import { DIRS, type Grid } from "../src/types";
import { buildInitialTemplatesState } from "../src/services/fillJobService";
import {
  buildFillReviewPayload,
  applyReviewTemplateOverrides,
  applyTemplateReviewResult,
  collectReviewUsageState,
} from "../src/services/fillJobReviewStateService";
import { buildReviewTemplate, type ReviewTemplate } from "../src/services/fillJobReviewService";
import {
  buildFinalSlotState,
  collectTemplateWords,
  validateNeighborWordReuse,
  validateTemplateDefinitions,
} from "../src/services/fillFinalizeService";

const grid: Grid = {
  rows: 1,
  cols: 3,
  data: ["***"],
  marker: "000",
  codes: [[1, 1, 1]],
};

function makeReviewTemplate(key: string, name: string, word: string, definition: string, order: number): ReviewTemplate {
  return {
    key,
    name,
    sourceName: `${name}.fsh`,
    order,
    path: `sample/${name}.fsh`,
    language: "ru",
    langId: 1,
    grid,
    slots: [
      {
        slotId: 1,
        r: 0,
        c: 0,
        dir: "right",
        len: 3,
        cells: [
          [0, 0],
          [0, 1],
          [0, 2],
        ],
        word,
        wordId: `${order + 10}`,
        opredId: `${order + 100}`,
        definition,
        definitionOptions: [{ opredId: `${order + 100}`, text: definition }],
        isPhotoDefinition: false,
        photoAreaBounds: null,
        availableImages: [],
        selectedImageId: null,
        intersections: [],
        clueCell: { key: `${key}-0-0`, row: 0, col: 0 },
        startNumber: 1,
      },
    ],
    clueGroups: [{ key: `${key}-0-0`, row: 0, col: 0, slotIds: [1], areaCellCount: 1 }],
    startPositions: [{ number: 1, r: 0, c: 0, dir: "right", slotId: 1 }],
  };
}

function runBuildReviewPayloadSmoke() {
  const entry = {
    key: "tpl-1",
    path: "sample/1.fsh",
    name: "1",
    sourceName: "1.fsh",
    order: 0,
    grid,
    slots: [
      {
        id: 1,
        r: 0,
        c: 0,
        dir: DIRS.right,
        len: 3,
        cells: [
          [0, 0],
          [0, 1],
          [0, 2],
        ] as [number, number][],
      },
    ],
    startNumberBySlotId: new Map([[1, 1]]),
    startPositions: [{ number: 1, r: 0, c: 0, dir: "right" as const, slotId: 1 }],
    lenCounts: new Map([[3, 1]]),
    stats: {
      slots: 1,
      letters: 3,
      uniqueCells: 3,
      intersections: 0,
      density: 0,
      maxDegree: 0,
      avgDegree: 0,
      degreeSqSum: 0,
    },
  };
  const builtTemplate = buildReviewTemplate(
    entry,
    ["КОТ"],
    "ru",
    1,
    new Map([
      [
        "КОТ",
        {
          wordId: 10n,
          opredId: 100n,
          definition: "Домашний хищник",
          definitions: [{ opredId: 100n, text: "Домашний хищник" }],
        },
      ],
    ]),
    new Map([["КОТ", "Кот"]]),
    new Map(),
    new Set(),
  );
  const payload = buildFillReviewPayload(
    {
      issueId: "1",
      editionId: 2,
      editionCode: "E2",
      issueLabel: "42",
    },
    {
      style: "corel",
      writeCrw: false,
      usageStats: true,
    },
    [builtTemplate],
  );
  assert.equal(payload.templates.length, 1);
  assert.equal(payload.templates[0]?.slots[0]?.word, "КОТ");
  assert.equal(payload.templates[0]?.slots[0]?.definition, "Домашний хищник");
}

function runTemplateStateSmoke() {
  const resolved = [
    { key: "tpl-1", name: "1", sourceName: "1.fsh", order: 0, path: "sample/1.fsh" },
    { key: "tpl-2", name: "2", sourceName: "2.fsh", order: 1, path: "sample/2.fsh" },
  ];
  const entryByKey = new Map([
    [
      "tpl-1",
      {
        key: "tpl-1",
        path: "sample/1.fsh",
        name: "1",
        sourceName: "1.fsh",
        order: 0,
        grid,
        slots: [],
        startNumberBySlotId: new Map(),
        startPositions: [],
        lenCounts: new Map(),
        stats: {
          slots: 0,
          letters: 0,
          uniqueCells: 0,
          intersections: 0,
          density: 0,
          maxDegree: 0,
          avgDegree: 0,
          degreeSqSum: 0,
        },
      },
    ],
  ]);
  const invalidByKey = new Map([["tpl-2", { key: "tpl-2", name: "2", error: "broken template" }]]);
  const states = buildInitialTemplatesState(resolved, entryByKey, invalidByKey);
  assert.deepEqual(
    states.map((item) => ({ key: item.key, status: item.status, error: item.error ?? null })),
    [
      { key: "tpl-1", status: "pending", error: null },
      { key: "tpl-2", status: "error", error: "broken template" },
    ],
  );
}

function runOverlayAndUsageSmoke() {
  const review = buildFillReviewPayload(
    {
      issueId: "1",
      editionId: 2,
      editionCode: "E2",
      issueLabel: "42",
    },
    { style: "corel", writeCrw: false, usageStats: true },
    [
      makeReviewTemplate("tpl-1", "1", "КОТ", "Кот", 0),
      makeReviewTemplate("tpl-2", "2", "ДОМ", "Дом", 1),
    ],
  );
  const effective = applyReviewTemplateOverrides(review, [
    {
      key: "tpl-2",
      slots: [{ slotId: 1, word: "ЛЕС", definition: "Лес" }],
    },
  ]);
  assert.equal(effective.templates[1]?.slots[0]?.word, "ЛЕС");
  assert.equal(effective.templates[1]?.slots[0]?.definition, "Лес");

  const usage = collectReviewUsageState(effective, "tpl-1");
  assert.equal(usage.usedWordsInJob.has("КОТ"), false);
  assert.equal(usage.usedWordsInJob.has("ЛЕС"), true);
  assert.equal(usage.usedWordCountInJob.get("ЛЕС"), 1);
  assert.equal(usage.usedDefinitionKeys.has("лес"), true);
}

function runRegenerationMergeSmoke() {
  const review = buildFillReviewPayload(
    {
      issueId: "1",
      editionId: 2,
      editionCode: "E2",
      issueLabel: "42",
    },
    { style: "corel", writeCrw: false, usageStats: true },
    [
      makeReviewTemplate("tpl-1", "1", "КОТ", "Кот", 0),
      makeReviewTemplate("tpl-2", "2", "ЛЕС", "Лес", 1),
    ],
  );
  const templatesState = [
    { key: "tpl-1", name: "1", status: "done" as const, error: null, order: 0, sourceName: "1.fsh" },
    { key: "tpl-2", name: "2", status: "done" as const, error: null, order: 1, sourceName: "2.fsh" },
  ];

  const success = applyTemplateReviewResult(review, templatesState, "tpl-1", {
    type: "success",
    template: makeReviewTemplate("tpl-1", "1", "СОН", "Сон", 0),
  });
  assert.equal(success.review.templates.length, 2);
  assert.equal(success.review.templates[0]?.slots[0]?.word, "СОН");
  assert.equal(success.review.templates[1]?.slots[0]?.word, "ЛЕС");
  assert.deepEqual(
    success.templatesState.map((item) => ({ key: item.key, status: item.status, error: item.error ?? null })),
    [
      { key: "tpl-1", status: "done", error: null },
      { key: "tpl-2", status: "done", error: null },
    ],
  );

  const failure = applyTemplateReviewResult(review, templatesState, "tpl-1", {
    type: "error",
    error: "no-solution",
  });
  assert.equal(failure.review.templates.length, 1);
  assert.equal(failure.review.templates[0]?.key, "tpl-2");
  assert.deepEqual(
    failure.templatesState.map((item) => ({ key: item.key, status: item.status, error: item.error ?? null })),
    [
      { key: "tpl-1", status: "error", error: "no-solution" },
      { key: "tpl-2", status: "done", error: null },
    ],
  );
}

function runFinalizeInvariantSmoke() {
  const template = makeReviewTemplate("tpl-1", "1", "КОТ", "Очень длинное определение для проверки лимита", 0);
  const neighbor = makeReviewTemplate("tpl-2", "2", "КОТ", "Сосед", 1);
  const stateResult = buildFinalSlotState(template.slots[0], null);
  const states = new Map([[template.slots[0].slotId, stateResult.state]]);
  const words = collectTemplateWords(states);
  const neighborWords = new Map<string, Map<string, number>>([["tpl-2", new Map([["КОТ", 1]])]]);
  const neighbors = new Map<string, Set<string>>([["tpl-1", new Set(["tpl-2"])]]); 
  const templateNames = new Map<string, string>([["tpl-2", "2"]]);

  assert.ok(
    validateTemplateDefinitions(template, states, { maxPerCell: 10, maxPerHalfCell: 5 })[0]?.includes("exceeds 10 symbols"),
  );
  assert.ok(
    validateNeighborWordReuse(template, words, neighbors, neighborWords, templateNames)[0]?.includes("neighboring template 2 slot 1"),
  );
  assert.equal(neighbor.slots[0]?.word, "КОТ");
}

runBuildReviewPayloadSmoke();
runTemplateStateSmoke();
runOverlayAndUsageSmoke();
runRegenerationMergeSmoke();
runFinalizeInvariantSmoke();

console.log("fill review regeneration smoke checks passed");
