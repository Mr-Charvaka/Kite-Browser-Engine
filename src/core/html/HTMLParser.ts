import { DOMArena, NodeType } from "../memory/DOMArena";
import type { Token } from "./HTMLTokenizer";
import { TokenType } from "./HTMLTokenizer";
import { TelemetryBus, TracePhase } from "../observability/TelemetryBus";

export class HTMLParser {
    arena: DOMArena;
    openElements: number[] = [];

    constructor(arena: DOMArena) {
        this.arena = arena;
    }

    parse(tokens: Token[]): number {
        TelemetryBus.publish(TracePhase.Begin, 'Parser', 'Tree Construction');
        
        const documentId = this.arena.allocateNode(NodeType.Document, "#document");
        this.openElements.push(documentId);

        for (const token of tokens) {
            const currentParentId = this.openElements[this.openElements.length - 1];

            if (token.type === TokenType.StartTag) {
                const elementId = this.arena.allocateNode(NodeType.Element, token.tagName);
                this.arena.appendChild(currentParentId, elementId);
                
                if (!["img", "br", "hr", "meta", "link"].includes(token.tagName || "")) {
                    this.openElements.push(elementId);
                }
            } else if (token.type === TokenType.EndTag) {
                for (let i = this.openElements.length - 1; i >= 0; i--) {
                    const id = this.openElements[i];
                    // We can use string table to get tag name quickly
                    const offset = id * DOMArena.NODE_SIZE;
                    const tagNameIdx = this.arena.buffer[offset + DOMArena.OFFSET_TAG_NAME];
                    const tagName = this.arena.getString(tagNameIdx);
                    
                    if (tagName === token.tagName) {
                        this.openElements.length = i;
                        break;
                    }
                }
            } else if (token.type === TokenType.Character) {
                if (token.data && token.data.trim().length > 0) {
                    const textId = this.arena.allocateNode(NodeType.Text, "#text", token.data);
                    this.arena.appendChild(currentParentId, textId);
                }
            }
        }

        TelemetryBus.publish(TracePhase.End, 'Parser', 'Tree Construction', { nodesAllocated: this.arena.nextNodeId });
        return documentId;
    }
}
