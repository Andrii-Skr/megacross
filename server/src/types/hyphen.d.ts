type HyphenOptions = {
  exceptions?: string[];
  hyphenChar?: string;
  minWordLength?: number;
};

declare module "hyphen/ru" {
  const api: {
    hyphenate(text: string, options?: HyphenOptions): Promise<string>;
    hyphenateHTML(text: string, options?: HyphenOptions): Promise<string>;
    hyphenateHTMLSync(text: string, options?: HyphenOptions): string;
    hyphenateSync(text: string, options?: HyphenOptions): string;
    patterns: unknown;
  };

  export default api;
}
