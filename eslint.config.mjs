import next from "eslint-config-next";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  // next-env.d.ts lo genera Next y no se edita a mano.
  {
    ignores: [
      ".next/**",
      ".vercel/**",
      ".output/**",
      "node_modules/**",
      ".test-build/**",
      "next-env.d.ts",
    ],
  },
  ...next,
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default config;
