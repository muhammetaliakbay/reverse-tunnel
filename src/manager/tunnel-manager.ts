import {BehaviorSubject, combineLatest, Observable, Subscription} from 'rxjs';
import {ForwardRule, TunnelStore} from './tunnel-store';
import {distinctUntilChanged, filter, map, switchMap} from 'rxjs/operators';
import {ForwardSession, ListenInfo, TunnelConnection} from '../implementation/client';
import {arraysDifference, observableArrayDifference} from '../util/difference';

export type ForwardStatus = {
    readonly code: 'error',
    readonly message: string
} | {
    readonly code: 'listening'
} | {
    readonly code: 'establishing'
};

export type ExtendedForwardStatus = ForwardStatus | {
    readonly code: 'not-available'
};

export interface ForwardRuleAndStatus {
    readonly rule: ForwardRule,
    readonly status: ForwardStatus
}

export interface ForwardRuleAndSession {
    readonly rule: ForwardRule,
    readonly session: Subscription
}

function inputIsNotNullOrUndefined<T>(input: null | undefined | T): input is T {
    return input !== null && input !== undefined;
}

function createSmartForwardSession(
    forwardRule: ForwardRule
): Observable<ForwardStatus> {
    return combineLatest([
        forwardRule.tunnelServer.flatSelf$,
        forwardRule.flat$
    ]).pipe(switchMap(
        ([server, rule]) =>
            new ForwardSession(
                {
                    server: {
                        endpoint: {
                            host: server.host,
                            port: server.port
                        },
                        auth: {
                            password: server.password
                        },
                        timeoutMS: 7500,
                    },
                    source: {
                        host: rule.sourceHost,
                        port: rule.sourcePort
                    },
                    destination: {
                        host: rule.destinationHost,
                        port: rule.destinationPort
                    }
                }
            )
    ));
}

export class TunnelManager {
    private forwardStatusesSubject = new BehaviorSubject<ForwardRuleAndStatus[]>([])
    readonly forwardStatuses$: Observable<ForwardRuleAndStatus[]> =
        this.forwardStatusesSubject.pipe(map(s => s.slice()));

    private forwardSessions: ForwardRuleAndSession[] = [];

    constructor(
        readonly tunnelStore: TunnelStore
    ) {
        const {added, removed} = observableArrayDifference(tunnelStore.forwardRules$);
        added.subscribe(rule => {
            const entry: ForwardRuleAndStatus = {
                rule,
                status: {
                    code: 'establishing'
                }
            };
            this.forwardStatusesSubject.value.push(entry);
            this.forwardStatusesSubject.next(
                this.forwardStatusesSubject.value
            );
            this.forwardSessions.push({
                rule,
                session: createSmartForwardSession(rule)
                    .subscribe(status => {
                        (entry as {status: ForwardStatus}).status = status;
                        this.forwardStatusesSubject.next(
                            this.forwardStatusesSubject.value
                        );
                    })
            });
        });
        removed.subscribe(rule => {
            this.forwardSessions.splice(
                this.forwardSessions.findIndex(
                    s => s.rule === rule
                )
            )[0]?.session?.unsubscribe();
            this.forwardStatusesSubject.next(
                this.forwardStatusesSubject.value.filter(
                    s => s.rule !== rule
                )
            );
        });
    }

    observeStatus(forwardRule: ForwardRule): Observable<ExtendedForwardStatus> {
        return this.forwardStatuses$.pipe(
            map(statuses => statuses.find(s => s.rule === forwardRule)?.status),
            distinctUntilChanged(),
            map(status => status == null ? {
                code: 'not-available'
            } : status)
        );
    }

    private updateStatus(rule: ForwardRule, status: ForwardStatus | null) {
        this.forwardStatusesSubject.next(
            status == null ?
                this.forwardStatusesSubject.value.filter(s => s.rule !== rule):
                this.forwardStatusesSubject.value.map(s => s.rule === rule ? {
                    rule,
                    status
                } : s)
        );
    }

    private forward(rule: ForwardRule): void {

    }

    private cancelForward(rule: ForwardRule): void {

    }
}
