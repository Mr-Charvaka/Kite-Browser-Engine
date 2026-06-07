# 🛠️ Kite – A Browser‑Engine‑Observability Playground

Kite is a lightweight **React + TypeScript** playground that visualises the inner workings of a web browser engine.  
It bundles a tiny, custom engine written in TypeScript and provides interactive pages that let you explore how browsers **parse HTML**, **layout**, **paint**, **GPU compositing**, and **run scripts**.

## ✨ Features

| Area | Implemented pages | Description |
|------|-------------------|-------------|
| **HTML Parsing** | `DOMPage` | Shows the source HTML, the token stream produced by `HTMLTokenizer`, and the resulting DOM tree built by `HTMLParser`. |
| **Layout** | `LayoutPage` | Visualises the layout tree and box model calculations performed by the engine. |
| **Painting** | `PaintPage` | Demonstrates the paint list generation, layer creation and draw order. |
| **GPU Compositing** | `GPUPage` | Shows how painting results are turned into GPU layers and composited. |
| **Scripting** | `ScriptingPage` | Executes simple JavaScript snippets in a sandboxed `EngineContext`, letting you see DOM mutations in real‑time. |
| **Engine Core** | `src/core/*` | - **HTML** (`HTMLTokenizer.ts`, `HTMLParser.ts`) – tokenises and parses HTML strings.<br>- **Memory** (`DOMArena.ts`) – a lightweight DOM arena that stores nodes and provides fast lookup.<br>- **Observability** (`TelemetryBus.ts`) – a publish/subscribe bus used by UI components to react to engine events (parsing, layout, paint, script execution). |
| **UI** | `src/components/*` | - `TopAppBar`, `SideNavBar`, `FooterBar` – consistent navigation and theming (Tailwind CSS).<br>- Each page is a self‑contained visualisation that subscribes to `TelemetryBus` to display live engine data. |
| **State Management** | `EngineContext.tsx` | React context that wires the engine to the UI, providing hooks for the pages to dispatch actions and receive telemetry. |

## 🚀 Getting Started

```
# Clone the repo
git clone https://github.com/your‑username/Kite-Browser-Engine.git
cd Kite

# Install dependencies
npm install

# Run the development server
npm run dev
```
Open http://localhost:5173 (or the URL shown in the console). Use the side navigation to explore each engine stage.

📚 How It Works
HTML → Tokenizer → Parser – HTMLTokenizer breaks raw HTML into tokens; HTMLParser builds a DOM tree stored in DOMArena.
Layout – Traverses the DOM, computes box dimensions, and creates a layout tree.
Paint – Generates paint commands for each layout node, groups them into layers.
GPU – Simulates GPU compositing by ordering layers and applying transforms.
Scripting – A tiny JS sandbox runs snippets, mutates the DOM, and fires telemetry events so the UI updates instantly.
All stages emit events on TelemetryBus, which the UI components listen to, allowing real‑time visual feedback.

🛠️ Extending Kite
Add a new engine stage – Create a new folder under src/core/, implement the logic, emit events via TelemetryBus, then add a page under src/pages/.
Custom visualisations – Extend the UI components in src/components/ or create new ones. Hook them into the context with useEngineContext.
Styling – Tailwind is already configured; modify src/App.css or add new utility classes.

📄 Objective
Kite is a learning tool for anyone curious about browser internals, from students to developers building custom rendering pipelines. Happy hacking! 🎉
Feel free to adjust wording, add a badge section, or include screenshots of each page to make the README even richer.
