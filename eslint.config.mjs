import nextVitals from "eslint-config-next/core-web-vitals";

export default [
  {
    ignores: [".next/**", ".open-next/**", ".wrangler/**", "node_modules/**", "artifacts/**", "supabase/.temp/**", "supabase/functions/**"],
  },
  ...nextVitals,
  {
    rules: {
      "import/no-anonymous-default-export": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
      "@next/next/no-location-assign-relative-destination": "off",
    },
  },
];
