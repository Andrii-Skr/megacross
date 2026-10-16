import { spawnSync } from "node:child_process";
import { copyFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL("../native/template-generator/", import.meta.url));
const build = spawnSync("cargo", ["build", "--release", "--locked", "--manifest-path", path.join(directory, "Cargo.toml"), "--target-dir", path.join(directory, "target"), ...process.argv.slice(2)], { stdio: "inherit" });
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);
const library = process.platform === "darwin" ? "libtemplate_generator_native.dylib" : process.platform === "win32" ? "template_generator_native.dll" : "libtemplate_generator_native.so";
const target = path.join(directory, "template_generator.node");
const temporary = `${target}.tmp-${process.pid}`;
try {
  await copyFile(path.join(directory, "target", "release", library), temporary);
  await rename(temporary, target);
} finally { await rm(temporary, { force: true }); }
console.log(`Built ${target}`);
