/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
      extend: {
          "colors": {
              "on-surface-variant": "#b9cacb",
              "surface": "#131313",
              "on-tertiary": "#412d00",
              "on-error-container": "#ffdad6",
              "tertiary": "#fff4e8",
              "background": "#131313",
              "surface-container-high": "#2a2a2a",
              "primary-fixed-dim": "#00dbe9",
              "secondary-fixed": "#f6d9ff",
              "outline": "#849495",
              "tertiary-fixed": "#ffdea8",
              "secondary-fixed-dim": "#e9b3ff",
              "on-surface": "#e5e2e1",
              "surface-container-low": "#1c1b1b",
              "surface-dim": "#131313",
              "on-tertiary-container": "#7d5800",
              "surface-container": "#201f1f",
              "primary-container": "#00f0ff",
              "tertiary-fixed-dim": "#ffba20",
              "on-secondary-fixed": "#310048",
              "on-primary": "#00363a",
              "on-secondary-container": "#e5a9ff",
              "primary": "#dbfcff",
              "surface-bright": "#3a3939",
              "error": "#ffb4ab",
              "on-error": "#690005",
              "on-tertiary-fixed": "#271900",
              "on-primary-fixed-variant": "#004f54",
              "secondary": "#e9b3ff",
              "on-primary-container": "#006970",
              "surface-tint": "#00dbe9",
              "inverse-primary": "#006970",
              "outline-variant": "#3b494b",
              "on-tertiary-fixed-variant": "#5e4200",
              "surface-variant": "#353534",
              "surface-container-highest": "#353534",
              "inverse-surface": "#e5e2e1",
              "on-secondary": "#510074",
              "on-background": "#e5e2e1",
              "secondary-container": "#7d01b1",
              "tertiary-container": "#ffd386",
              "inverse-on-surface": "#313030",
              "on-secondary-fixed-variant": "#7200a3",
              "error-container": "#93000a",
              "primary-fixed": "#7df4ff",
              "on-primary-fixed": "#002022",
              "surface-container-lowest": "#0e0e0e"
          },
          "borderRadius": {
              "DEFAULT": "0.125rem",
              "lg": "0.25rem",
              "xl": "0.5rem",
              "full": "0.75rem"
          },
          "spacing": {
              "sm": "8px",
              "lg": "24px",
              "pane-gutter": "1px",
              "base": "4px",
              "xs": "4px",
              "md": "16px"
          },
          "fontFamily": {
              "body-sm": ["Inter"],
              "body-md": ["Inter"],
              "label-caps": ["JetBrains Mono"],
              "display-data": ["JetBrains Mono"],
              "headline-sm": ["JetBrains Mono"],
              "code-sm": ["JetBrains Mono"]
          },
          "fontSize": {
              "body-sm": ["12px", { "lineHeight": "16px", "fontWeight": "400" }],
              "body-md": ["14px", { "lineHeight": "20px", "fontWeight": "400" }],
              "label-caps": ["10px", { "lineHeight": "12px", "letterSpacing": "0.05em", "fontWeight": "700" }],
              "display-data": ["24px", { "lineHeight": "32px", "letterSpacing": "-0.02em", "fontWeight": "700" }],
              "headline-sm": ["16px", { "lineHeight": "24px", "fontWeight": "600" }],
              "code-sm": ["12px", { "lineHeight": "18px", "fontWeight": "400" }]
          }
      }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ],
}
