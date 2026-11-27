import next from "eslint-config-next";
const config = [
  { ignores: [".next/**", ".*/**", "release/**", "design/**", "node_modules/**", "next-env.d.ts"] },
  ...next,
  // Sign-in, sign-up, sign-out and a 401 load the page afresh on purpose, so no signed-in state survives in memory.
  { rules: { "@next/next/no-location-assign-relative-destination": "off" } },
];
export default config;
