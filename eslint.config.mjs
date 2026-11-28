import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Nicki graczy trafiają na stronę jako tekst, który React zawsze escapuje. Wstawianie surowego HTML
  // (dangerouslySetInnerHTML) ominęłoby tę ochronę, a CSP przepuszcza skrypty inline.
  {
    rules: {
      "react/no-danger": "error",
      "react/no-danger-with-children": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Gra na micro:bita to osobny projekt MakeCode
    "microbit/**",
  ]),
]);

export default eslintConfig;
