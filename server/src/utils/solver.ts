import { ColumnGrid, Cell } from "./parseFsh";
import { extractSlots, Slot, Dir } from "./slots";

export interface SolveResult { filled: ColumnGrid; used: string[]; }

/** dict: длина → слова */
export function solve(colGrid: ColumnGrid, dict: Map<number,string[]>): SolveResult {
  const cols = colGrid.length;
  const rows = colGrid[0].length;

  /* рабочая сетка букв (“#” остаётся, пустое — “”) */
  const letters: string[] = colGrid.map(col =>
    col.split("").map(ch => (ch === "#" ? "#" : "")).join("")
  );

  const slots = extractSlots(colGrid);
  const used  = new Set<string>();
  const step: Record<Dir,[number,number]> = { down:[0,1], right:[1,0] };

  const can = (w:string,s:Slot)=>{
    let [c,r] = [s.c,s.r];
    const [dc,dr] = step[s.dir];
    for (let i=0;i<s.len;i++,c+=dc,r+=dr) {
      const ch = letters[c][r];
      if (ch && ch !== w[i]) return false;
    }
    return true;
  };

  const write = (w:string,s:Slot,on:boolean)=>{
    let [c,r] = [s.c,s.r];
    const [dc,dr] = step[s.dir];
    for (let i=0;i<s.len;i++,c+=dc,r+=dr) {
      const col = letters[c].split("");
      col[r] = on ? w[i] : "";
      letters[c] = col.join("");
    }
  };

  function dfs(k:number):boolean {
    if (k === slots.length) return true;
    const s = slots[k];
    const list = dict.get(s.len) ?? [];
    for (const w of list) {
      if (used.has(w) || !can(w,s)) continue;
      write(w,s,true); used.add(w);
      if (dfs(k+1)) return true;
      write(w,s,false); used.delete(w);
    }
    return false;
  }
  if (!dfs(0)) throw new Error("словаря не хватает");

  return { filled: letters, used: [...used] };
}
