import nextCoreWebVitals from "eslint-config-next/core-web-vitals"

export default [
  { ignores: [".next/**", ".next-dev/**", "eslint.config.mjs", "postcss.config.mjs"] },
  ...nextCoreWebVitals,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
]
