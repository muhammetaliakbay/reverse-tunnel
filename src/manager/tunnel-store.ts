import {BehaviorSubject, combineLatest, interval, Observable, of} from 'rxjs';
import {debounce, distinctUntilChanged, map, switchMap} from 'rxjs/operators';
import {filterRedundant} from '../util/difference';
import {array, constant, ExportedStructureType, number, object, string} from '@muhammetaliakbay/structure-check';
import {ConfigService} from '@muhammetaliakbay/json-config';

class BugException extends Error {
}

export interface FlatTunnelServerSelf {
    host: string,
    port: number,
    password: string,
}
export interface FlatTunnelServer extends FlatTunnelServerSelf{
    forwardRules: FlatForwardRule[]
}

export abstract class TunnelServer {
    private static nextIdentity: number = 0;
    readonly identity: string = '#' + TunnelServer.nextIdentity ++;

    readonly abstract tunnelStore: TunnelStore;

    readonly abstract host$: Observable<string>;
    readonly abstract port$: Observable<number>;
    readonly abstract password$: Observable<string>;
    readonly abstract forwardRules$: Observable<ForwardRule[]>;

    readonly abstract flatForwardRules$: Observable<FlatForwardRule[]>;
    readonly abstract flatSelf$: Observable<FlatTunnelServerSelf>;
    readonly abstract flat$: Observable<FlatTunnelServer>;
}

class TunnelServerImpl extends TunnelServer {
    readonly hostSubject = new BehaviorSubject<string>('');
    readonly portSubject = new BehaviorSubject<number>(-1);
    readonly passwordSubject = new BehaviorSubject<string>('');

    readonly host$ = this.hostSubject.pipe(distinctUntilChanged());
    readonly port$ = this.portSubject.pipe(distinctUntilChanged());
    readonly password$ = this.passwordSubject.pipe(distinctUntilChanged());

    readonly flatForwardRules$: Observable<FlatForwardRule[]>;
    readonly flatSelf$: Observable<FlatTunnelServerSelf>;
    readonly flat$: Observable<FlatTunnelServer>;

    constructor(
        readonly tunnelStore: TunnelStoreImpl,
        host: string, port: number, password: string, readonly forwardRules$: Observable<ForwardRule[]>
    ) {
        super();
        this.hostSubject.next(host);
        this.portSubject.next(port);
        this.passwordSubject.next(password);

        this.flatForwardRules$ = forwardRules$.pipe(
            switchMap(rules => rules.length > 0 ? combineLatest(rules.map(rule => rule.flat$)): of([])),
        );

        this.flatSelf$ = combineLatest([
            this.host$, this.port$, this.password$
        ]).pipe(map(([host, port, password]) => ({
            host, port, password
        })));

        this.flat$ = combineLatest([
            this.flatSelf$,
            this.flatForwardRules$,
        ]).pipe(map(([
                         self, forwardRules
                     ]) => ({
            ...self, forwardRules
        })));
    }
}

export interface FlatForwardRule {
    sourceHost: string;
    sourcePort: number;
    destinationHost: string;
    destinationPort: number;
}
export abstract class ForwardRule {
    private static nextIdentity: number = 0;
    readonly identity: string = '#' + ForwardRule.nextIdentity ++;

    readonly abstract tunnelServer: TunnelServer;

    readonly abstract sourceHost$: Observable<string>;
    readonly abstract sourcePort$: Observable<number>;

    readonly abstract destinationHost$: Observable<string>;
    readonly abstract destinationPort$: Observable<number>;

    readonly abstract flat$: Observable<FlatForwardRule>;
}

class ForwardRuleImpl extends ForwardRule {
    readonly sourceHostSubject = new BehaviorSubject<string>('');
    readonly sourcePortSubject = new BehaviorSubject<number>(-1);
    readonly destinationHostSubject = new BehaviorSubject<string>('');
    readonly destinationPortSubject = new BehaviorSubject<number>(-1);

    readonly sourceHost$ = this.sourceHostSubject.pipe(distinctUntilChanged());
    readonly sourcePort$ = this.sourcePortSubject.pipe(distinctUntilChanged());
    readonly destinationHost$ = this.destinationHostSubject.pipe(distinctUntilChanged());
    readonly destinationPort$ = this.destinationPortSubject.pipe(distinctUntilChanged());

    readonly flat$ = combineLatest([
        this.sourceHost$,
        this.sourcePort$,
        this.destinationHost$,
        this.destinationPort$
    ]).pipe(map(([
            sourceHost, sourcePort,
            destinationHost, destinationPort
        ]) => ({
        sourceHost, sourcePort,
        destinationHost, destinationPort
    })));

    constructor(
        readonly tunnelServer: TunnelServerImpl,
        sourceHost: string, sourcePort: number,
        destinationHost: string, destinationPort: number
    ) {
        super();
        this.sourceHostSubject.next(sourceHost);
        this.sourcePortSubject.next(sourcePort);
        this.destinationHostSubject.next(destinationHost);
        this.destinationPortSubject.next(destinationPort);
    }
}

export class DuplicatedServerException extends Error {}
export class ObjectNotOwnedException extends Error {}

export abstract class TunnelStore {
    readonly abstract servers$: Observable<TunnelServer[]>;
    readonly abstract forwardRules$: Observable<ForwardRule[]>;

    readonly abstract flatServers$: Observable<FlatTunnelServer[]>;
    readonly abstract flatForwardRules$: Observable<FlatForwardRule[]>;

    abstract findServer(host: string, port: number): Promise<TunnelServer | undefined>;
    abstract addServer(host: string, port: number, password: string): Promise<TunnelServer>;
    abstract updateServer(tunnelServer: TunnelServer, properties: {
        host?: string,
        port?: number,
        password?: string,
    }): void;
    abstract removeServer(tunnelServer: TunnelServer): Promise<void>;

    abstract addForwardRule(
        tunnelServer: TunnelServer,
        sourceHost: string, sourcePort: number,
        destinationHost: string, destinationPort: number
    ): Promise<ForwardRule>;
    abstract updateForwardRule(
        forwardRule: ForwardRule,
        properties: {
            sourceHost?: string,
            sourcePort?: number,
            destinationHost?: string,
            destinationPort?: number,
        }
    ): void;
    abstract removeForwardRule(forwardRule: ForwardRule): Promise<void>;
}

class TunnelStoreImpl extends TunnelStore {
    serversSubject = new BehaviorSubject<TunnelServerImpl[]>([]);
    readonly servers$ = this.serversSubject.pipe(map(servers => servers.slice()));

    forwardRulesSubject = new BehaviorSubject<ForwardRuleImpl[]>([]);
    readonly forwardRules$ = this.forwardRulesSubject.pipe(map(rules => rules.slice()));

    readonly flatForwardRules$ = this.forwardRules$.pipe(
        switchMap(rules => rules.length > 0 ? combineLatest(rules.map(rule => rule.flat$)) : of([]))
    )
    readonly flatServers$ = this.servers$.pipe(
        switchMap(servers => servers.length > 0 ? combineLatest(servers.map(server => server.flat$)) : of([])),
    );

    private assertOwnedServer(tunnelServer: TunnelServer): tunnelServer is TunnelServerImpl | never {
        if (this.serversSubject.value.includes(tunnelServer as any)) {
            return true;
        } else {
            throw new ObjectNotOwnedException();
        }
    }

    private assertOwnedRule(forwardRule: ForwardRule): forwardRule is ForwardRuleImpl | never {
        if (this.forwardRulesSubject.value.includes(forwardRule as any)) {
            return true;
        } else {
            throw new ObjectNotOwnedException();
        }
    }

    async findServer(host: string, port: number): Promise<TunnelServer | undefined> {
        return this.serversSubject.value.find(
            server => server.hostSubject.value === host && server.portSubject.value === port
        );
    }

    async addServer(host: string, port: number, password: string): Promise<TunnelServer> {
        const existingServer = await this.findServer(host, port);
        if (existingServer != null) {
            throw new DuplicatedServerException();
        } else {
            const tunnelServer: TunnelServerImpl = new TunnelServerImpl(
                this,
                host, port, password,
                filterRedundant(
                    this.forwardRules$.pipe(
                        map(rules => rules.filter(rule => rule.tunnelServer === tunnelServer))
                    )
                )
            );
            this.serversSubject.value.push(
                tunnelServer
            );
            this.serversSubject.next(
                this.serversSubject.value
            );
            return tunnelServer;
        }
    }

    async updateServer(
        tunnelServer: TunnelServer,
        properties: {
            host?: string;
            port?: number;
            password?: string
        }): Promise<void> {
        if (this.assertOwnedServer(tunnelServer)) {
            if (typeof properties.host === 'string') {
                tunnelServer.hostSubject.next(properties.host);
            }
            if (typeof properties.port === 'number') {
                tunnelServer.portSubject.next(properties.port);
            }
            if (typeof properties.password === 'string') {
                tunnelServer.passwordSubject.next(properties.password);
            }
        } else {
            throw new BugException();
        }
    }

    async removeServer(tunnelServer: TunnelServer): Promise<void> {
        if (this.assertOwnedServer(tunnelServer)) {
            this.serversSubject.next(
                this.serversSubject.value.filter(
                    server => server !== tunnelServer
                )
            );
            this.forwardRulesSubject.next(
                this.forwardRulesSubject.value.filter(
                    rule => rule.tunnelServer !== tunnelServer
                )
            );
        } else {
            throw new BugException();
        }
    }

    async addForwardRule(
        tunnelServer: TunnelServer,
        sourceHost: string, sourcePort: number,
        destinationHost: string, destinationPort: number
    ): Promise<ForwardRule> {
        if (this.assertOwnedServer(tunnelServer)) {
            const rule = new ForwardRuleImpl(
                tunnelServer,
                sourceHost, sourcePort,
                destinationHost, destinationPort
            );
            this.forwardRulesSubject.value.push(
                rule
            );
            this.forwardRulesSubject.next(
                this.forwardRulesSubject.value
            );
            return rule;
        } else {
            throw new BugException();
        }
    }

    async updateForwardRule(
        forwardRule: ForwardRule,
        properties: {
            sourceHost?: string;
            sourcePort?: number;
            destinationHost?: string;
            destinationPort?: number
        }): Promise<void> {
        if (this.assertOwnedRule(forwardRule)) {
            if (typeof properties.sourceHost === 'string') {
                forwardRule.sourceHostSubject.next(properties.sourceHost);
            }
            if (typeof properties.sourcePort === 'number') {
                forwardRule.sourcePortSubject.next(properties.sourcePort);
            }
            if (typeof properties.destinationHost === 'string') {
                forwardRule.destinationHostSubject.next(properties.destinationHost);
            }
            if (typeof properties.destinationPort === 'number') {
                forwardRule.destinationPortSubject.next(properties.destinationPort);
            }
        } else {
            throw new BugException();
        }
    }

    async removeForwardRule(forwardRule: ForwardRule): Promise<void> {
        if (this.assertOwnedRule(forwardRule)) {
            this.forwardRulesSubject.next(
                this.forwardRulesSubject.value.filter(
                    rule => rule !== forwardRule
                )
            );
        } else {
            throw new BugException();
        }
    }
}

const storeConfigType = object({
    configVersion: constant<1>(1),
    servers: array(object({
        host: string(),
        port: number(),
        password: string(),
        forwardRules: array(object({
            sourceHost: string(),
            sourcePort: number(),
            destinationHost: string(),
            destinationPort: number()
        }))
    }))
});
type StoreConfig = ExportedStructureType<typeof storeConfigType>;
type StoreConfigService = ConfigService<StoreConfig>;

function createStoreConfigService(configFile: string): StoreConfigService {
    return new ConfigService<StoreConfig>(
        configFile,
        storeConfigType,
        () => ({
            configVersion: 1,
            servers: []
        })
    );
}

export async function createTunnelStore(configFile: string): Promise<TunnelStore> {
    const configService = createStoreConfigService(configFile);
    const config = await configService.readConfig();
    const store = new TunnelStoreImpl();

    for (const confServer of config.servers) {
        const server = await store.addServer(confServer.host, confServer.port, confServer.password);
        for (const confRule of confServer.forwardRules) {
            await store.addForwardRule(
                server,
                confRule.sourceHost, confRule.sourcePort,
                confRule.destinationHost, confRule.destinationPort
            );
        }
    }

    store.flatServers$
        .pipe(debounce(() => interval(1500)))
        .subscribe(async servers => {
            try {
                await configService.writeConfig({
                    configVersion: 1,
                    servers: servers.map(server => ({
                        host: server.host,
                        port: server.port,
                        password: server.password,
                        forwardRules: server.forwardRules.map(
                            rule => ({
                                sourceHost: rule.sourceHost,
                                sourcePort: rule.sourcePort,
                                destinationHost: rule.destinationHost,
                                destinationPort: rule.destinationPort
                            })
                        )
                    }))
                });
            } catch (e) {
                console.error('error while saving store config', e)
                return;
            }
            console.log('saved configuration');
        });

    return store;
}

