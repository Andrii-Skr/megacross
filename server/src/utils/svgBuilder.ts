import { writeFileSync } from "fs";
import { ColumnGrid } from "./parseFsh";

export function buildSvg(grid: ColumnGrid, cell=20, out="crossword.svg") {
  const cols = grid.length, rows = grid[0].length;
  const W = cols*cell, H = rows*cell;

  const rects: string[] = [];
  const texts: string[] = [];

  for (let c=0;c<cols;c++){
    for (let r=0;r<rows;r++){
      const x=c*cell, y=r*cell, ch=grid[c][r];
      rects.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${ch==="#"?"black":"white"}" stroke="black"/>`);
      if (ch && ch!=="#"){
        texts.push(`<text x="${x+cell/2}" y="${y+cell*0.7}" font-size="${cell*0.7}" text-anchor="middle" font-family="sans-serif">${ch}</text>`);
      }
    }
  }
  writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">\n${rects.join("\n")}\n${texts.join("\n")}\n</svg>`);
}
