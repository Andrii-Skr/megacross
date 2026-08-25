"use client";

import { z } from "zod";

// Keep client-side validation compatible with the production CSP without unsafe-eval.
z.config({ jitless: true });

export { z };
