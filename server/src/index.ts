import { loadSampleCrosswords } from "./services/crosswordService";
import { checkSingleSlots } from "./utils/checkSingleSlots";

const crosswords = loadSampleCrosswords();
for (const cw of crosswords) checkSingleSlots(cw);
