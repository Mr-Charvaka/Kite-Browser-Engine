import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { DOMArena } from './memory/DOMArena';
import { HTMLTokenizer } from './html/HTMLTokenizer';
import type { Token } from './html/HTMLTokenizer';
import { HTMLParser } from './html/HTMLParser';
import { TelemetryBus, TracePhase } from './observability/TelemetryBus';
import type { TraceEvent } from './observability/TelemetryBus';

export interface EngineState {
  arena: DOMArena | null;
  tokens: Token[];
  domTree: any;
  arenaStats: { nodes: number; bytes: number; depth: number };
  parseTime: number;
  telemetryLog: TraceEvent[];
  htmlInput: string;
}

interface EngineContextType {
  state: EngineState;
  setHtmlInput: (html: string) => void;
  reinitialize: () => void;
  compile: (html?: string) => void;
}

const defaultState: EngineState = {
  arena: null, tokens: [], domTree: null,
  arenaStats: { nodes: 0, bytes: 0, depth: 0 },
  parseTime: 0, telemetryLog: [], htmlInput: '',
};

const EngineContext = createContext<EngineContextType>({
  state: defaultState,
  setHtmlInput: () => {},
  reinitialize: () => {},
  compile: () => {},
});

export function useEngine() { return useContext(EngineContext); }

function getTreeDepth(node: any): number {
  if (!node?.children?.length) return 0;
  return 1 + Math.max(...node.children.map(getTreeDepth));
}

const DEFAULT_HTML = `<html>
  <head>
    <title>BEO Level 1</title>
  </head>
  <body>
    <div id="container">
      <p>Hello, World</p>
    </div>
  </body>
</html>`;

export function EngineProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<EngineState>({ ...defaultState, htmlInput: DEFAULT_HTML });
  const logRef = useRef<TraceEvent[]>([]);

  const compile = useCallback((html?: string) => {
    const input = html ?? state.htmlInput;
    const t0 = performance.now();
    TelemetryBus.getLedger().length = 0;

    const arena = new DOMArena(1000);
    const tokenizer = new HTMLTokenizer();
    const tokenList = tokenizer.tokenize(input);
    const parser = new HTMLParser(arena);
    const documentId = parser.parse(tokenList);
    const tree = arena.toJSON(documentId);
    const t1 = performance.now();

    const newLog = [...TelemetryBus.getLedger()];
    logRef.current = [...logRef.current, ...newLog].slice(-200);

    setState(prev => ({
      ...prev,
      arena,
      tokens: tokenList,
      domTree: tree,
      arenaStats: {
        nodes: arena.nextNodeId - 1,
        bytes: arena.nextNodeId * DOMArena.NODE_SIZE * 4,
        depth: getTreeDepth(tree),
      },
      parseTime: t1 - t0,
      telemetryLog: logRef.current,
      htmlInput: input,
    }));
  }, [state.htmlInput]);

  const reinitialize = useCallback(() => {
    logRef.current = [];
    TelemetryBus.getLedger().length = 0;
    TelemetryBus.publish(TracePhase.Instant, 'System', 'Reinitialize');
    setState({ ...defaultState, htmlInput: DEFAULT_HTML });
    // Recompile after reset
    setTimeout(() => {
      const t0 = performance.now();
      const arena = new DOMArena(1000);
      const tokenizer = new HTMLTokenizer();
      const tokenList = tokenizer.tokenize(DEFAULT_HTML);
      const parser = new HTMLParser(arena);
      const documentId = parser.parse(tokenList);
      const tree = arena.toJSON(documentId);
      const t1 = performance.now();
      logRef.current = [...TelemetryBus.getLedger()];
      setState({
        arena, tokens: tokenList, domTree: tree,
        arenaStats: { nodes: arena.nextNodeId - 1, bytes: arena.nextNodeId * DOMArena.NODE_SIZE * 4, depth: getTreeDepth(tree) },
        parseTime: t1 - t0, telemetryLog: logRef.current, htmlInput: DEFAULT_HTML,
      });
    }, 50);
  }, []);

  const setHtmlInput = useCallback((html: string) => {
    setState(prev => ({ ...prev, htmlInput: html }));
  }, []);

  // Initial compile
  useEffect(() => { compile(DEFAULT_HTML); }, []);

  return (
    <EngineContext.Provider value={{ state, setHtmlInput, reinitialize, compile }}>
      {children}
    </EngineContext.Provider>
  );
}
