import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportSvgFilesToEps } from "../src/utils/epsExport";

const directory = mkdtempSync(join(tmpdir(), "megacross-eps-test-"));
const originalEnv = { ...process.env };
const executable = join(directory, "converter");
const profileRecord = join(directory, "profile.txt");
const svgPath = join(directory, "drawing.svg");
const epsPath = join(directory, "drawing.eps");

try {
  writeFileSync(svgPath, '<svg xmlns="http://www.w3.org/2000/svg"/>');
  writeFileSync(executable, `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args.includes("--export-type=eps")) {
  fs.writeFileSync(${JSON.stringify(profileRecord)}, process.env.INKSCAPE_PROFILE_DIR);
  if (!fs.existsSync(process.env.INKSCAPE_PROFILE_DIR)) process.exit(2);
  // Exceed spawnSync's former 64 MiB limit on both output streams.
  const chunk = Buffer.alloc(1024 * 1024, "x");
  for (let i = 0; i < 65; i++) {
    fs.writeSync(1, chunk);
    fs.writeSync(2, chunk);
  }
  if (process.env.EPS_TEST_FAIL) process.exit(7);
  if (!process.env.EPS_TEST_MISSING) {
    for (const input of args.filter(arg => arg.endsWith(".svg"))) {
      fs.writeFileSync(input.replace(/\\.svg$/, ".eps"), "EPS fixture");
    }
  }
} else if (args.includes("--add-tiff-preview")) {
  fs.copyFileSync(args.at(-2), args.at(-1));
} else {
  const output = args.find(arg => arg.startsWith("-sOutputFile="));
  fs.copyFileSync(args.at(-1), output.slice("-sOutputFile=".length));
}
`, { mode: 0o755 });
  process.env.CROSS_INKSCAPE_BIN = executable;
  process.env.CROSS_GHOSTSCRIPT_BIN = executable;
  process.env.CROSS_EPSTOOL_BIN = executable;

  assert.deepEqual(await exportSvgFilesToEps([svgPath]), [epsPath]);
  assert.equal(readFileSync(epsPath, "utf8"), "EPS fixture");
  assert.ok(!existsSync(readFileSync(profileRecord, "utf8")), "profile must be removed after success");

  process.env.EPS_TEST_FAIL = "1";
  await assert.rejects(exportSvgFilesToEps([svgPath]), (error: Error) => {
    assert.match(error.message, /Inkscape: exited with code 7/);
    assert.ok(error.message.length < 1024 * 1024 + 200, "diagnostics must stay bounded");
    return true;
  });
  assert.ok(!existsSync(readFileSync(profileRecord, "utf8")), "profile must be removed after failure");
  delete process.env.EPS_TEST_FAIL;

  rmSync(epsPath);
  process.env.EPS_TEST_MISSING = "1";
  await assert.rejects(exportSvgFilesToEps([svgPath]), /completed without creating/);
  delete process.env.EPS_TEST_MISSING;

  process.env.CROSS_INKSCAPE_BIN = join(directory, "missing-inkscape");
  await assert.rejects(exportSvgFilesToEps([svgPath]), /Inkscape was not found.*CROSS_INKSCAPE_BIN/);
  assert.deepEqual(await exportSvgFilesToEps([]), []);
  console.log("EPS export smoke passed");
} finally {
  process.env = originalEnv;
  rmSync(directory, { recursive: true, force: true });
}
