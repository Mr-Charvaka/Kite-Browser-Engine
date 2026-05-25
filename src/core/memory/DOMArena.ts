export const NodeType = {
    Element: 1,
    Text: 2,
    Comment: 3,
    Document: 4,
    1: 'Element',
    2: 'Text',
    3: 'Comment',
    4: 'Document'
} as const;
export type NodeType = typeof NodeType[keyof typeof NodeType];

export class DOMArena {
    static readonly NODE_SIZE = 10; // Number of uint32 elements per node
    
    // Memory layout indices
    static readonly OFFSET_ID = 0;
    static readonly OFFSET_PARENT = 1;
    static readonly OFFSET_FIRST_CHILD = 2;
    static readonly OFFSET_LAST_CHILD = 3;
    static readonly OFFSET_NEXT_SIBLING = 4;
    static readonly OFFSET_PREV_SIBLING = 5;
    static readonly OFFSET_TYPE = 6;
    static readonly OFFSET_TAG_NAME = 7;
    static readonly OFFSET_TEXT_DATA = 8;
    static readonly OFFSET_FLAGS = 9;

    buffer: Uint32Array;
    nextNodeId: number = 1; // 0 is reserved for null/root
    stringTable: string[] = [""]; // index 0 is empty string

    constructor(maxNodes: number = 10000) {
        this.buffer = new Uint32Array(maxNodes * DOMArena.NODE_SIZE);
    }

    allocateNode(type: number, tagName: string = "", textData: string = ""): number {
        const id = this.nextNodeId++;
        const offset = id * DOMArena.NODE_SIZE;
        
        this.buffer[offset + DOMArena.OFFSET_ID] = id;
        this.buffer[offset + DOMArena.OFFSET_PARENT] = 0;
        this.buffer[offset + DOMArena.OFFSET_FIRST_CHILD] = 0;
        this.buffer[offset + DOMArena.OFFSET_LAST_CHILD] = 0;
        this.buffer[offset + DOMArena.OFFSET_NEXT_SIBLING] = 0;
        this.buffer[offset + DOMArena.OFFSET_PREV_SIBLING] = 0;
        this.buffer[offset + DOMArena.OFFSET_TYPE] = type;
        
        this.buffer[offset + DOMArena.OFFSET_TAG_NAME] = this.internString(tagName);
        this.buffer[offset + DOMArena.OFFSET_TEXT_DATA] = this.internString(textData);
        this.buffer[offset + DOMArena.OFFSET_FLAGS] = 0;

        return id;
    }

    private internString(str: string): number {
        if (!str) return 0;
        let idx = this.stringTable.indexOf(str);
        if (idx === -1) {
            idx = this.stringTable.length;
            this.stringTable.push(str);
        }
        return idx;
    }

    getString(index: number): string {
        return this.stringTable[index] || "";
    }

    appendChild(parentId: number, childId: number) {
        const parentOffset = parentId * DOMArena.NODE_SIZE;
        const childOffset = childId * DOMArena.NODE_SIZE;

        this.buffer[childOffset + DOMArena.OFFSET_PARENT] = parentId;

        const lastChildId = this.buffer[parentOffset + DOMArena.OFFSET_LAST_CHILD];
        
        if (lastChildId === 0) {
            // First child
            this.buffer[parentOffset + DOMArena.OFFSET_FIRST_CHILD] = childId;
            this.buffer[parentOffset + DOMArena.OFFSET_LAST_CHILD] = childId;
        } else {
            // Append to end
            const lastChildOffset = lastChildId * DOMArena.NODE_SIZE;
            this.buffer[lastChildOffset + DOMArena.OFFSET_NEXT_SIBLING] = childId;
            this.buffer[childOffset + DOMArena.OFFSET_PREV_SIBLING] = lastChildId;
            this.buffer[parentOffset + DOMArena.OFFSET_LAST_CHILD] = childId;
        }
    }

    // For DevTools / Inspector to convert memory back to an object tree
    toJSON(id: number): any {
        if (id === 0) return null;
        const offset = id * DOMArena.NODE_SIZE;
        const type = this.buffer[offset + DOMArena.OFFSET_TYPE];
        
        const obj: any = {
            id,
            type: NodeType[type as keyof typeof NodeType],
            tagName: this.getString(this.buffer[offset + DOMArena.OFFSET_TAG_NAME]),
            textData: this.getString(this.buffer[offset + DOMArena.OFFSET_TEXT_DATA]),
            children: []
        };

        let childId = this.buffer[offset + DOMArena.OFFSET_FIRST_CHILD];
        while (childId !== 0) {
            obj.children.push(this.toJSON(childId));
            const childOffset = childId * DOMArena.NODE_SIZE;
            childId = this.buffer[childOffset + DOMArena.OFFSET_NEXT_SIBLING];
        }

        return obj;
    }
}
