export const TracePhase = {
    Begin: 'B',
    End: 'E',
    Instant: 'I'
} as const;

export type TracePhase = typeof TracePhase[keyof typeof TracePhase];

export interface TraceEvent {
    phase: TracePhase;
    category: string;
    name: string;
    timestamp: number;
    args?: any;
}

type Subscriber = (event: TraceEvent) => void;

export class TelemetryBus {
    private static subscribers: Subscriber[] = [];
    private static ledger: TraceEvent[] = [];

    static subscribe(sub: Subscriber) {
        this.subscribers.push(sub);
    }

    static publish(phase: TracePhase, category: string, name: string, args?: any) {
        const event: TraceEvent = {
            phase,
            category,
            name,
            timestamp: performance.now(),
            args
        };
        this.ledger.push(event);
        for (const sub of this.subscribers) {
            sub(event);
        }
    }

    static getLedger() {
        return this.ledger;
    }
}
