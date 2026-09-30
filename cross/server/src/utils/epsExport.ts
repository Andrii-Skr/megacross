import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { extname, join, parse } from "node:path";
import { tmpdir } from "node:os";
import { create, type Font, type FontCollection } from "fontkit";

const INKSCAPE_MAX_OUTPUT_BUFFER = 64 * 1024 * 1024;
const PROCESS_OUTPUT_BUFFER = 1024 * 1024;
const DEFAULT_POSTPROCESS_CONCURRENCY = 3;
const MAX_POSTPROCESS_CONCURRENCY = 8;

function resolveInkscapeBin(): string {
  const configured = process.env.CROSS_INKSCAPE_BIN?.trim();
  return configured || "inkscape";
}

function resolveGhostscriptBin(): string {
  const configured = process.env.CROSS_GHOSTSCRIPT_BIN?.trim();
  return configured || "gs";
}

function resolveEpsToolBin(): string {
  const configured = process.env.CROSS_EPSTOOL_BIN?.trim();
  return configured || "epstool";
}

function resolvePostprocessConcurrency(): number {
  const configured = Number(process.env.CROSS_EPS_POSTPROCESS_CONCURRENCY);
  if (!Number.isFinite(configured) || configured < 1) return DEFAULT_POSTPROCESS_CONCURRENCY;
  return Math.min(MAX_POSTPROCESS_CONCURRENCY, Math.trunc(configured));
}

function toEpsPath(svgPath: string): string {
  const parsed = parse(svgPath);
  return join(parsed.dir, `${parsed.name}.eps`);
}

type EpsFont = {
  familyName: string;
  fontFaceCss: string;
  data: Uint8Array;
  format: "ttf" | "otf" | "woff" | "woff2";
};

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function prepareFontConfig(profileDir: string, font: EpsFont): string {
  if (font.format !== "ttf" && font.format !== "otf") {
    throw new Error(`EPS export requires a TTF or OTF font; received ${font.format}`);
  }
  const parsed = create(Buffer.from(font.data)) as Font | FontCollection;
  const actualFont = "fonts" in parsed ? parsed.fonts[0] : parsed;
  if (!actualFont?.familyName) throw new Error("EPS export could not read the uploaded font family");

  const fontsDir = join(profileDir, "fonts");
  const cacheDir = join(profileDir, "font-cache");
  mkdirSync(fontsDir);
  mkdirSync(cacheDir);
  writeFileSync(join(fontsDir, `uploaded.${font.format}`), font.data);
  const systemConfig = [
    process.env.FONTCONFIG_FILE,
    "/etc/fonts/fonts.conf",
    "/opt/homebrew/etc/fonts/fonts.conf",
    "/usr/local/etc/fonts/fonts.conf",
  ].find((candidate) => candidate && existsSync(candidate));
  const include = systemConfig ? `<include ignore_missing="yes">${escapeXml(systemConfig)}</include>` : "";
  const configPath = join(profileDir, "fonts.conf");
  writeFileSync(configPath, `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  ${include}
  <dir>${escapeXml(fontsDir)}</dir>
  <cachedir>${escapeXml(cacheDir)}</cachedir>
  <alias binding="strong"><family>${escapeXml(font.familyName)}</family><prefer><family>${escapeXml(actualFont.familyName)}</family></prefer></alias>
</fontconfig>`);
  return configPath;
}

function throwProcessError(context: string, result: ReturnType<typeof spawnSync>): never {
  if (result.error) {
    const error = result.error as NodeJS.ErrnoException;
    const reason = error.code === "ENOENT" ? `${context} executable was not found.` : error.message;
    throw new Error(`EPS export failed: ${reason}`);
  }
  const details = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
  throw new Error(`EPS export failed during ${context}.${details ? ` ${details}` : ""}`);
}

function runProcess(context: string, executable: string, args: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const output: string[] = [];
    let outputLength = 0;

    const collectOutput = (chunk: Buffer): void => {
      if (outputLength >= PROCESS_OUTPUT_BUFFER) return;
      const text = chunk.toString("utf8");
      const remaining = PROCESS_OUTPUT_BUFFER - outputLength;
      output.push(text.slice(0, remaining));
      outputLength += Math.min(text.length, remaining);
    };

    child.stdout.on("data", collectOutput);
    child.stderr.on("data", collectOutput);
    child.once("error", (error: NodeJS.ErrnoException) => {
      const reason = error.code === "ENOENT" ? `${context} executable was not found.` : error.message;
      reject(new Error(`EPS export failed: ${reason}`));
    });
    child.once("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const details = output.join("").trim();
      const status = signal ? ` terminated by ${signal}` : ` exited with code ${String(code)}`;
      reject(new Error(`EPS export failed during ${context}:${status}.${details ? ` ${details}` : ""}`));
    });
  });
}

async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<void>
): Promise<void> {
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await task(items[index]);
    }
  };
  const results = await Promise.allSettled(
    Array.from({ length: Math.min(concurrency, items.length) }, worker)
  );
  const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failed) throw failed.reason;
}

async function convertEpsToGrayscale(epsPath: string): Promise<void> {
  const parsed = parse(epsPath);
  const tempDir = mkdtempSync(join(parsed.dir, ".megacross-grayscale-"));
  const tempPath = join(tempDir, parsed.base);

  try {
    await runProcess(
      "Ghostscript",
      resolveGhostscriptBin(),
      [
        "-q",
        "-dSAFER",
        "-dBATCH",
        "-dNOPAUSE",
        // Preserve Inkscape's drawing bounds instead of clipping wide EPS
        // files to Ghostscript's default paper width (A4/Letter).
        "-dEPSCrop",
        "-dLanguageLevel=3",
        "-sDEVICE=eps2write",
        "-sColorConversionStrategy=Gray",
        "-sProcessColorModel=DeviceGray",
        `-sOutputFile=${tempPath}`,
        epsPath,
      ]
    );
    if (!existsSync(tempPath)) {
      throw new Error(`EPS export failed: Ghostscript did not create ${tempPath}`);
    }
    renameSync(tempPath, epsPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function addTiffPreview(epsPath: string): Promise<void> {
  const parsed = parse(epsPath);
  const tempDir = mkdtempSync(join(parsed.dir, ".megacross-preview-"));
  const tempPath = join(tempDir, parsed.base);

  try {
    await runProcess(
      "epstool",
      resolveEpsToolBin(),
      [
        "--quiet",
        "--add-tiff-preview",
        "--device",
        "tiffgray",
        "--dpi",
        "96",
        "--gs",
        resolveGhostscriptBin(),
        epsPath,
        tempPath,
      ]
    );
    if (!existsSync(tempPath)) {
      throw new Error(`EPS export failed: epstool did not create ${tempPath}`);
    }
    renameSync(tempPath, epsPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Converts SVG files to grayscale EPS. Inkscape converts text to paths;
 * Ghostscript then changes vector colors to DeviceGray without rasterizing the
 * document. A grayscale TIFF preview is embedded last for applications that do
 * not render EPS. Independent EPS files are postprocessed concurrently; set
 * CROSS_EPS_POSTPROCESS_CONCURRENCY to control the worker count.
 */
export async function exportSvgFilesToEps(svgPaths: readonly string[], font?: EpsFont | null): Promise<string[]> {
  if (svgPaths.length === 0) return [];

  for (const svgPath of svgPaths) {
    if (extname(svgPath).toLowerCase() !== ".svg") {
      throw new Error(`EPS export accepts only SVG files: ${svgPath}`);
    }
    if (!existsSync(svgPath)) {
      throw new Error(`Cannot export missing SVG file to EPS: ${svgPath}`);
    }
  }

  const epsPaths = svgPaths.map(toEpsPath);
  const profileDir = mkdtempSync(join(tmpdir(), "megacross-inkscape-"));
  const temporarySvgPaths: string[] = [];
  const temporaryEpsPaths: string[] = [];
  const result = (() => {
    try {
      const fontConfig = font ? prepareFontConfig(profileDir, font) : null;
      const inputPaths = font
        ? svgPaths.map((svgPath) => {
            const parsed = parse(svgPath);
            const temporarySvgPath = join(parsed.dir, `${parsed.name}.eps-source-${randomUUID()}.svg`);
            const embeddedFontStyle = `<style type="text/css"><![CDATA[${font.fontFaceCss}]]></style>`;
            const source = readFileSync(svgPath, "utf8");
            if (!source.includes(embeddedFontStyle)) {
              throw new Error(`EPS export could not locate the uploaded font in ${svgPath}`);
            }
            writeFileSync(temporarySvgPath, source.replace(embeddedFontStyle, ""));
            temporarySvgPaths.push(temporarySvgPath);
            temporaryEpsPaths.push(toEpsPath(temporarySvgPath));
            return temporarySvgPath;
          })
        : svgPaths;
      return spawnSync(
        resolveInkscapeBin(),
        [
          "--export-type=eps",
          "--export-area-drawing",
          "--export-text-to-path",
          "--export-overwrite",
          ...inputPaths,
        ],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            INKSCAPE_PROFILE_DIR: profileDir,
            ...(fontConfig ? { FONTCONFIG_FILE: fontConfig, XDG_CACHE_HOME: profileDir } : {}),
          },
          maxBuffer: INKSCAPE_MAX_OUTPUT_BUFFER,
          stdio: ["ignore", "ignore", "pipe"],
        }
      );
    } finally {
      rmSync(profileDir, { recursive: true, force: true });
      for (const temporarySvgPath of temporarySvgPaths) rmSync(temporarySvgPath, { force: true });
    }
  })();

  try {
    if (result.error) {
      const error = result.error as NodeJS.ErrnoException;
      const reason = error.code === "ENOENT"
        ? `Inkscape was not found (${resolveInkscapeBin()}). Install it or set CROSS_INKSCAPE_BIN.`
        : error.message;
      throw new Error(`EPS export failed: ${reason}`);
    }
    if (result.status !== 0) {
      throwProcessError("Inkscape", result);
    }

    const generatedEpsPaths = font ? temporaryEpsPaths : epsPaths;
    const missing = generatedEpsPaths.filter((epsPath) => !existsSync(epsPath));
    if (missing.length > 0) {
      throw new Error(`EPS export completed without creating: ${missing.join(", ")}`);
    }
    if (font) {
      generatedEpsPaths.forEach((generatedPath, index) => renameSync(generatedPath, epsPaths[index]));
    }
  } finally {
    for (const temporaryEpsPath of temporaryEpsPaths) rmSync(temporaryEpsPath, { force: true });
  }

  await runWithConcurrency(epsPaths, resolvePostprocessConcurrency(), async (epsPath) => {
    await convertEpsToGrayscale(epsPath);
    await addTiffPreview(epsPath);
  });

  return epsPaths;
}
