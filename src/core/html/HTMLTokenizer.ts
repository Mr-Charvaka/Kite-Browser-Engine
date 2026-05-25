import { TelemetryBus, TracePhase } from "../observability/TelemetryBus";

export const TokenType = {
    Character: 0,
    StartTag: 1,
    EndTag: 2,
    EOF: 3,
    0: 'Character',
    1: 'StartTag',
    2: 'EndTag',
    3: 'EOF'
} as const;
export type TokenType = typeof TokenType[keyof typeof TokenType];

export interface Token {
    type: TokenType;
    tagName?: string;
    data?: string;
}

const State = {
    Data: 0,
    TagOpen: 1,
    EndTagOpen: 2,
    TagName: 3,
    BeforeAttributeName: 4,
    0: 'Data',
    1: 'TagOpen',
    2: 'EndTagOpen',
    3: 'TagName',
    4: 'BeforeAttributeName'
} as const;
type State = typeof State[keyof typeof State];

export class HTMLTokenizer {
    private state: State = State.Data;
    private input: string = "";
    private index: number = 0;
    private currentToken: Token | null = null;
    private tokens: Token[] = [];

    tokenize(html: string): Token[] {
        TelemetryBus.publish(TracePhase.Begin, 'Parser', 'HTML Tokenization');
        
        this.input = html;
        this.index = 0;
        this.state = State.Data;
        this.tokens = [];

        while (this.index < this.input.length) {
            const char = this.input[this.index];
            
            switch (this.state) {
                case State.Data:
                    if (char === '<') {
                        this.state = State.TagOpen;
                    } else {
                        this.emitCharacter(char);
                    }
                    break;
                case State.TagOpen:
                    if (char === '/') {
                        this.state = State.EndTagOpen;
                    } else if (/[a-zA-Z]/.test(char)) {
                        this.state = State.TagName;
                        this.currentToken = { type: TokenType.StartTag, tagName: char.toLowerCase() };
                    }
                    break;
                case State.EndTagOpen:
                    if (/[a-zA-Z]/.test(char)) {
                        this.state = State.TagName;
                        this.currentToken = { type: TokenType.EndTag, tagName: char.toLowerCase() };
                    }
                    break;
                case State.TagName:
                    if (char === '>') {
                        this.emitCurrentToken();
                        this.state = State.Data;
                    } else if (/\s/.test(char)) {
                        this.state = State.BeforeAttributeName;
                    } else {
                        if (this.currentToken) this.currentToken.tagName += char.toLowerCase();
                    }
                    break;
                case State.BeforeAttributeName:
                    if (char === '>') {
                        this.emitCurrentToken();
                        this.state = State.Data;
                    }
                    break;
            }
            this.index++;
        }
        
        this.tokens.push({ type: TokenType.EOF });
        
        TelemetryBus.publish(TracePhase.End, 'Parser', 'HTML Tokenization', { tokenCount: this.tokens.length });
        return this.tokens;
    }

    private emitCharacter(char: string) {
        if (this.tokens.length > 0) {
            const lastToken = this.tokens[this.tokens.length - 1];
            if (lastToken.type === TokenType.Character) {
                lastToken.data += char;
                return;
            }
        }
        this.tokens.push({ type: TokenType.Character, data: char });
    }

    private emitCurrentToken() {
        if (this.currentToken) {
            this.tokens.push(this.currentToken);
            this.currentToken = null;
        }
    }
}
