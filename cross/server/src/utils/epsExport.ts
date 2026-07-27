import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { extname, join, parse } from "node:path";
import { tmpdir } from "node:os";

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

function toEpsPath(svgPath: string): string {
  const parsed = parse(svgPath);
  return join(parsed.dir, `${parsed.name}.eps`);
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

function convertEpsToGrayscale(epsPath: string): void {
  const parsed = parse(epsPath);
  const tempDir = mkdtempSync(join(parsed.dir, ".megacross-grayscale-"));
  const tempPath = join(tempDir, parsed.base);

  try {
    const result = spawnSync(
      resolveGhostscriptBin(),
      [
        "-q",
        "-dSAFER",
        "-dBATCH",
        "-dNOPAUSE",
        "-dLanguageLevel=3",
        "-sDEVICE=eps2write",
        "-sColorConversionStrategy=Gray",
        "-sProcessColorModel=DeviceGray",
        `-sOutputFile=${tempPath}`,
        epsPath,
      ],
      { encoding: "utf8" }
    );
    if (result.status !== 0 || result.error) throwProcessError("Ghostscript", result);
    if (!existsSync(tempPath)) {
      throw new Error(`EPS export failed: Ghostscript did not create ${tempPath}`);
    }
    renameSync(tempPath, epsPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function addTiffPreview(epsPath: string): void {
  const parsed = parse(epsPath);
  const tempDir = mkdtempSync(join(parsed.dir, ".megacross-preview-"));
  const tempPath = join(tempDir, parsed.base);

  try {
    const result = spawnSync(
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
      ],
      { encoding: "utf8" }
    );
    if (result.status !== 0 || result.error) throwProcessError("epstool", result);
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
 * not render EPS.
 */
export function exportSvgFilesToEps(svgPaths: readonly string[]): string[] {
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
  const result = (() => {
    try {
      return spawnSync(
        resolveInkscapeBin(),
        [
          "--export-type=eps",
          "--export-area-drawing",
          "--export-text-to-path",
          "--export-overwrite",
          ...svgPaths,
        ],
        {
          encoding: "utf8",
          env: { ...process.env, INKSCAPE_PROFILE_DIR: profileDir },
        }
      );
    } finally {
      rmSync(profileDir, { recursive: true, force: true });
    }
  })();

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

  const missing = epsPaths.filter((epsPath) => !existsSync(epsPath));
  if (missing.length > 0) {
    throw new Error(`EPS export completed without creating: ${missing.join(", ")}`);
  }

  for (const epsPath of epsPaths) {
    convertEpsToGrayscale(epsPath);
    addTiffPreview(epsPath);
  }

  return epsPaths;
}
