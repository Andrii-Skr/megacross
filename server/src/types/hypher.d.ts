type HyphenationPatterns = {
  patterns: string[];
  leftmin?: number;
  rightmin?: number;
  [key: string]: unknown;
};

declare module "hypher" {
  export default class Hypher {
    constructor(patterns: HyphenationPatterns);
    hyphenate(word: string): string[];
    hyphenateText(text: string): string;
  }
}

declare module "hyphenation.ru" {
  const patterns: HyphenationPatterns;
  export default patterns;
}
