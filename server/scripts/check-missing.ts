// scripts/check-missing.ts
import { join } from "path";
import { parseFsh } from "../src/utils/parseFsh";
import { extractSlots } from "../src/utils/slots";
import { loadDictionary } from "../src/services/dictionary";

(async () => {
  const dict = await loadDictionary();                     // длина→слова[]
  const { grid, fileName } = parseFsh(
    join(process.cwd(), "sample", "3_ Сканворд.fsh")
  );
  const need = [...new Set(extractSlots(grid).map(s => s.len))].sort((a,b)=>a-b);
  const miss = need.filter(len => !dict.has(len));

  console.log(`\n${fileName}: требуются длины →`, need.join(", "));
  console.log(miss.length ? "НЕТ в словаре → " + miss.join(", ") : "Все длины есть");
})();
