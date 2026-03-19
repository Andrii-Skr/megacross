import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Cell } from "../src/types";
import { CLUE_MAP } from "../src/utils/clues";
import { CELL_STROKE_COLOR } from "./svg-theme";

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = join(__dirname, "../src/arrows");

type ArrowAsset = {
  body: string;
  width: number;
  height: number;
};

type StyleMap = Record<string, string>;
type ClassStyleMap = Record<string, StyleMap>;

const ARROW_FILES: Record<number, string> = {
  0x01: "01.svg",
  0x02: "02.svg",
  0x03: "03.svg",
  0x04: "04.svg",
  0x05: "05.svg",
  0x06: "06.svg",
  0x08: "08.svg",
  0x10: "10.svg",
  0x18: "18.svg",
  0x20: "20.svg",
  0x28: "28.svg",
  0x30: "30.svg",
  0x38: "38.svg",
};

const ARROW_CODES = Object.keys(ARROW_FILES).map((value) => Number(value));
const ARROW_RELOAD_CHECK_MS = 1000;

let cachedAssets: Record<number, ArrowAsset> | null = null;
let cachedSignature = "";
let lastSignatureCheckAt = 0;

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const updateBoundsPoint = (bounds: Bounds, x: number, y: number): void => {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
};

const parsePoints = (pointsRaw: string): [number, number][] => {
  const nums = pointsRaw
    .trim()
    .split(/[\s,]+/)
    .map((value) => Number.parseFloat(value))
    .filter((value) => Number.isFinite(value));
  const points: [number, number][] = [];
  for (let i = 0; i < nums.length - 1; i += 2) {
    points.push([nums[i], nums[i + 1]]);
  }
  return points;
};

const parseClassStyles = (source: string): ClassStyleMap => {
  const result: ClassStyleMap = {};
  const styleRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  for (const match of source.matchAll(styleRegex)) {
    const css = match[1]
      .replace(/<!\[CDATA\[/gi, "")
      .replace(/\]\]>/gi, "");
    const ruleRegex = /\.([_a-zA-Z][-\w]*)\s*\{([^}]*)\}/g;
    for (const rule of css.matchAll(ruleRegex)) {
      const className = rule[1];
      const declarations = rule[2];
      const styleMap: StyleMap = result[className] ?? {};
      for (const decl of declarations.split(";")) {
        const [rawProp, rawValue] = decl.split(":");
        const prop = (rawProp ?? "").trim().toLowerCase();
        const value = (rawValue ?? "").trim();
        if (!prop || !value) continue;
        styleMap[prop] = value;
      }
      result[className] = styleMap;
    }
  }
  return result;
};

const hasAttr = (tag: string, name: string): boolean => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\s${escaped}\\s*=`, "i").test(tag);
};

const insertAttr = (tag: string, name: string, value: string): string => {
  if (hasAttr(tag, name)) return tag;
  const close = tag.endsWith("/>") ? "/>" : ">";
  return `${tag.slice(0, -close.length)} ${name}="${value}"${close}`;
};

const inlineClassStyles = (bodyRaw: string, classStyles: ClassStyleMap): string => {
  return bodyRaw.replace(/<([a-zA-Z][\w:-]*)([^>]*)>/g, (full, tagName, attrs) => {
    if (full.startsWith("</")) return full;
    const classMatch = attrs.match(/\sclass\s*=\s*"([^"]+)"/i);
    if (!classMatch) return full;
    const classes = classMatch[1].trim().split(/\s+/).filter(Boolean);
    if (!classes.length) return full;

    const merged: StyleMap = {};
    for (const cls of classes) {
      const styleMap = classStyles[cls];
      if (!styleMap) continue;
      for (const [prop, value] of Object.entries(styleMap)) {
        merged[prop] = value;
      }
    }
    if (!Object.keys(merged).length) return full;

    let tag = `<${tagName}${attrs}>`;
    tag = tag.replace(/\sclass\s*=\s*"[^"]*"/i, "");
    const presentationalProps = [
      "fill",
      "fill-rule",
      "stroke",
      "stroke-width",
      "stroke-linecap",
      "stroke-linejoin",
      "stroke-miterlimit",
      "opacity",
    ];
    for (const prop of presentationalProps) {
      const value = merged[prop];
      if (!value) continue;
      tag = insertAttr(tag, prop, value);
    }
    return tag;
  });
};

const readNumericAttr = (tag: string, name: string): number | null => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`${escaped}\\s*=\\s*"([^"]+)"`, "i"));
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
};

const extractDrawableBounds = (body: string): Bounds | null => {
  const bounds: Bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };

  const polyRegex = /<(?:polyline|polygon)\b[^>]*\bpoints\s*=\s*"([^"]+)"[^>]*>/gi;
  for (const match of body.matchAll(polyRegex)) {
    const points = parsePoints(match[1]);
    for (const [x, y] of points) {
      updateBoundsPoint(bounds, x, y);
    }
  }

  const lineRegex = /<line\b[^>]*>/gi;
  for (const match of body.matchAll(lineRegex)) {
    const tag = match[0];
    const x1 = readNumericAttr(tag, "x1");
    const y1 = readNumericAttr(tag, "y1");
    const x2 = readNumericAttr(tag, "x2");
    const y2 = readNumericAttr(tag, "y2");
    if (x1 !== null && y1 !== null) updateBoundsPoint(bounds, x1, y1);
    if (x2 !== null && y2 !== null) updateBoundsPoint(bounds, x2, y2);
  }

  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY)) return null;
  return bounds;
};

const readArrow = (name: string): ArrowAsset => {
  const raw = readFileSync(join(base, name), "utf8");
  const svgMatch = raw.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  const bodyRaw = svgMatch ? svgMatch[1] : raw;
  const classStyles = parseClassStyles(raw);
  const bodyStyled = inlineClassStyles(bodyRaw, classStyles);
  const viewBoxMatch = raw.match(/viewBox="([^"]+)"/i);
  let width = 100;
  let height = 100;
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1]
      .trim()
      .split(/[\s,]+/)
      .map((v) => Number.parseFloat(v));
    if (parts.length === 4 && parts.every((v) => Number.isFinite(v))) {
      width = parts[2] ?? width;
      height = parts[3] ?? height;
    }
  } else {
    const widthMatch = raw.match(/width="([^"]+)"/i);
    const heightMatch = raw.match(/height="([^"]+)"/i);
    if (widthMatch) width = Number.parseFloat(widthMatch[1]) || width;
    if (heightMatch) height = Number.parseFloat(heightMatch[1]) || height;
  }
  const body = bodyStyled
    .replace(/<defs[\s\S]*?<\/defs>/gi, "")
    .replace(/<metadata\b[^>]*>[\s\S]*?<\/metadata>/gi, "")
    .replace(/<metadata\b[^>]*\/>/gi, "")
    .replace(/\s+id="[^"]*"/g, "")
    .replace(/stroke:(?:blue|#393185)/gi, `stroke:${CELL_STROKE_COLOR}`)
    .replace(/stroke="(?:blue|#393185)"/gi, `stroke="${CELL_STROKE_COLOR}"`)
    .trim();

  const bounds = extractDrawableBounds(body);
  if (!bounds) {
    return { body, width, height };
  }

  const boundsWidth = Math.max(1, bounds.maxX - bounds.minX);
  const boundsHeight = Math.max(1, bounds.maxY - bounds.minY);
  const oversizedCanvas = width / boundsWidth > 3 || height / boundsHeight > 3;
  if (!oversizedCanvas) {
    return { body, width, height };
  }

  const tx = Math.round(-bounds.minX * 1000) / 1000;
  const ty = Math.round(-bounds.minY * 1000) / 1000;
  return {
    body: `<g transform="translate(${tx} ${ty})">${body}</g>`,
    width: boundsWidth,
    height: boundsHeight,
  };
};

const computeSignature = (): string => {
  return ARROW_CODES
    .map((code) => {
      const name = ARROW_FILES[code];
      const file = join(base, name);
      const st = statSync(file);
      return `${name}:${st.mtimeMs}:${st.size}`;
    })
    .join("|");
};

const loadAssets = (): Record<number, ArrowAsset> => {
  const result: Record<number, ArrowAsset> = {};
  for (const code of ARROW_CODES) {
    result[code] = readArrow(ARROW_FILES[code]);
  }
  return result;
};

const getAssets = (): Record<number, ArrowAsset> => {
  const now = Date.now();
  if (cachedAssets && now - lastSignatureCheckAt < ARROW_RELOAD_CHECK_MS) {
    return cachedAssets;
  }

  lastSignatureCheckAt = now;
  const signature = computeSignature();
  if (!cachedAssets || signature !== cachedSignature) {
    cachedAssets = loadAssets();
    cachedSignature = signature;
  }

  return cachedAssets;
};

const getAsset = (code: number): ArrowAsset => getAssets()[code];

interface Arrow {
  code: number;
  asset: ArrowAsset;
  ax: number;
  ay: number;
}

type PosFn = (x: number, y: number, size: number, cell: number) => Arrow[];

type BatchArrowTuning = {
  scaleBoost: number;
  xAlign: number;
  yAlign: number;
  yShiftFactor: number;
};

const CLUE_POS_FACTORS: Record<number, [number, number]> = {
  1: [0, 0],
  2: [0.5, 0],
  3: [1, 0],
  4: [0, 0.5],
  5: [0.5, 0.5],
  6: [1, 0.5],
  7: [0, 1],
  8: [0.5, 1],
  9: [1, 1],
};

const EXCLUDED_ARROW_CODES = new Set<number>();

const keyByClue = (cluePos: number, dirKey: number): string => `${cluePos}:${dirKey}`;

const SIMPLE_ARROW_CLUE_POS: Record<number, number> = Object.fromEntries(
  Object.entries(CLUE_MAP)
    .map(([key, entries]) => [Number(key), entries] as const)
    .filter(([code, entries]) => {
      return (
        Number.isFinite(code) &&
        !EXCLUDED_ARROW_CODES.has(code) &&
        entries.length === 1 &&
        ARROW_FILES[code] !== undefined
      );
    })
    .map(([code, entries]) => [code, entries[0].cluePos])
) as Record<number, number>;

const SIMPLE_ARROW_BY_CLUE: Record<string, number> = Object.fromEntries(
  Object.entries(CLUE_MAP)
    .map(([key, entries]) => [Number(key), entries] as const)
    .filter(([code, entries]) => {
      return (
        Number.isFinite(code) &&
        !EXCLUDED_ARROW_CODES.has(code) &&
        entries.length === 1 &&
        ARROW_FILES[code] !== undefined
      );
    })
    .map(([code, entries]) => [keyByClue(entries[0].cluePos, entries[0].dirKey), code])
) as Record<string, number>;

const DOUBLE_ARROW_COMPONENTS: Record<number, number[]> = Object.fromEntries(
  Object.entries(CLUE_MAP)
    .map(([key, entries]) => [Number(key), entries] as const)
    .filter(([code, entries]) => {
      return (
        Number.isFinite(code) &&
        !EXCLUDED_ARROW_CODES.has(code) &&
        entries.length === 2 &&
        entries.every((entry) => SIMPLE_ARROW_BY_CLUE[keyByClue(entry.cluePos, entry.dirKey)] !== undefined)
      );
    })
    .map(([code, entries]) => [
      code,
      entries.map((entry) => SIMPLE_ARROW_BY_CLUE[keyByClue(entry.cluePos, entry.dirKey)]),
    ])
) as Record<number, number[]>;

const arrowAnchor = (code: number, x: number, y: number, size: number, cell: number): { ax: number; ay: number } => {
  const cluePos = SIMPLE_ARROW_CLUE_POS[code] ?? 5;
  const [fx, fy] = CLUE_POS_FACTORS[cluePos] ?? [0.5, 0.5];
  return {
    ax: x + cell * fx - size * fx,
    ay: y + cell * fy - size * fy,
  };
};

const singlePosFn = (code: number): PosFn => {
  return (x, y, size, cell) => {
    const { ax, ay } = arrowAnchor(code, x, y, size, cell);
    return [{ code, asset: getAsset(code), ax, ay }];
  };
};

const doublePosFn = (code: number): PosFn => {
  return (x, y, size, cell) => {
    const components = DOUBLE_ARROW_COMPONENTS[code] ?? [];
    return components.map((componentCode) => {
      const { ax, ay } = arrowAnchor(componentCode, x, y, size, cell);
      return {
        code: componentCode,
        asset: getAsset(componentCode),
        ax,
        ay,
      };
    });
  };
};

const buildSimpleArrowMap = (): Record<number, PosFn> => {
  const map: Record<number, PosFn> = {};
  for (const code of Object.keys(SIMPLE_ARROW_CLUE_POS).map((value) => Number(value))) {
    map[code] = singlePosFn(code);
  }
  for (const code of Object.keys(DOUBLE_ARROW_COMPONENTS).map((value) => Number(value))) {
    map[code] = doublePosFn(code);
  }
  return map;
};

const exportMap: Record<number, PosFn> = {
  ...buildSimpleArrowMap(),
};

const batchMap: Record<number, PosFn> = {
  ...buildSimpleArrowMap(),
};

export function arrowSvg(
  variant: "export" | "batch",
  code: number,
  orig: Cell,
  x: number,
  y: number,
  cell: number,
  size: number
): string {
  if ([0x01, 0x02, 0x03, 0x04, 0x05, 0x06].includes(code) && orig !== "↓") {
    return "";
  }
  const map = variant === "export" ? exportMap : batchMap;
  const fn = map[code];
  if (!fn) return "";
  const getBatchTuning = (arrowCode: number): BatchArrowTuning => {
    const cluePos = SIMPLE_ARROW_CLUE_POS[arrowCode] ?? 5;
    const [fx, fy] = CLUE_POS_FACTORS[cluePos] ?? [0.5, 0.5];
    if (arrowCode === 0x01) {
      return { scaleBoost: 0.3, xAlign: 0.5, yAlign: 0.5, yShiftFactor: -0.22 };
    }
    if (arrowCode === 0x02) {
      return { scaleBoost: 0.9, xAlign: fx, yAlign: fy, yShiftFactor: 0 };
    }
    if (arrowCode === 0x03) {
      return { scaleBoost: 0.7, xAlign: fx, yAlign: fy, yShiftFactor: 0 };
    }
    if (arrowCode === 0x06) {
      return { scaleBoost: 0.7, xAlign: fx, yAlign: fy, yShiftFactor: 0 };
    }
    if (arrowCode === 0x08) {
      return { scaleBoost: 0.7, xAlign: fx, yAlign: fy, yShiftFactor: 0 };
    }
    if (arrowCode === 0x18) {
      return { scaleBoost: 0.3, xAlign: 0, yAlign: 0.5, yShiftFactor: 0 };
    }
    if (arrowCode === 0x30) {
      return { scaleBoost: 0.7, xAlign: fx, yAlign: fy, yShiftFactor: 0 };
    }
    return { scaleBoost: 0.8, xAlign: fx, yAlign: fy, yShiftFactor: 0 };
  };
  return fn(x, y, size, cell)
    .map(({ code: arrowCode, asset, ax, ay }) => {
      const w = asset.width || size;
      const h = asset.height || size;
      const baseScale = Math.min(size / w, size / h);
      const cluePos = SIMPLE_ARROW_CLUE_POS[arrowCode] ?? 5;
      const [defaultXAlign, defaultYAlign] = CLUE_POS_FACTORS[cluePos] ?? [0.5, 0.5];
      const batchTuning = variant === "batch" ? getBatchTuning(arrowCode) : null;
      const scaleBoost = batchTuning ? batchTuning.scaleBoost : 1;
      const scale = baseScale * scaleBoost;
      const xAlign = batchTuning ? batchTuning.xAlign : defaultXAlign;
      const yAlign = batchTuning ? batchTuning.yAlign : defaultYAlign;
      const dx = ax + (size - w * scale) * xAlign;
      const dyBase = ay + (size - h * scale) * yAlign;
      const dy = dyBase + (batchTuning ? cell * batchTuning.yShiftFactor : 0);
      const tx = Math.round(dx * 1000) / 1000;
      const ty = Math.round(dy * 1000) / 1000;
      const sc = Math.round(scale * 1000) / 1000;
      return `<g transform="translate(${tx} ${ty}) scale(${sc})">${asset.body}</g>`;
    })
    .join("");
}
