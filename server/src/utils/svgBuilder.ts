import { writeFileSync } from "fs";

export function buildSvg(
  letters: string[][],
  cell = 20,
  outFile = "crossword.svg"
): void {
  const rows = letters.length, cols = letters[0].length;
  const w = cols * cell, h = rows * cell;
  const pathLines: string[] = [];
  const textLines: string[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cell, y = r * cell;
      pathLines.push(
        `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" ` +
          `fill="${letters[r][c] === "#" ? "black" : "white"}" stroke="black"/>`
      );
      if (letters[r][c] !== "#" && letters[r][c] !== "") {
        textLines.push(
          `<text x="${x + cell / 2}" y="${y + cell * 0.7}" font-size="${cell *
            0.7}" text-anchor="middle" font-family="sans-serif">${letters[r][c]}</text>`
        );
      }
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">\n` +
    pathLines.join("\n") +
    "\n" +
    textLines.join("\n") +
    "\n</svg>";

  writeFileSync(outFile, svg, "utf-8");
}
