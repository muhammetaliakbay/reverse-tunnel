import {Endpoint, join, connect} from './common';
import * as net from 'net';
import {BufferedReader, ExtendedReader} from './buffered-reader';
import {ExtendedWriter, SocketWriter} from './socket-writer';
import {
    AuthRequestPacket,
    AuthResponsePacket,
    IncomingConnectionPacket, JoinRequestPacket, JoinResponsePacket,
    ListenRequestPacket,
    ListenResponsePacket
} from './packets';
import {SocketChannel} from './socket-channel';
import {Observable} from 'rxjs';
import {ForwardStatus} from '../manager/tunnel-manager';

export interface ListenInfo {
    server: ServerInfo;
    source: Endpoint;
    destination: Endpoint;
    onListening?: () => void;
}

interface JoinInfo {
    server: ServerInfo;
    destination: Endpoint;
    socket: {
        identity: string;
        token: string;
    }
}

export enum CheckResult {
    OK,
    CONNECT_FAIL,
    AUTH_FAIL,
    TIMEOUT,
    UNEXPECTED
}

export class AuthFailException extends Error {}
export class ConnectFailException extends Error {}
export class TimeoutException extends Error {}

export const defaultPort = 1234;

async function timeout<T>(promise: Promise<T>, timeoutMS: number | undefined, onTimeout: () => Promise<T> | T): Promise<T> {
    if (typeof timeoutMS === 'undefined') {
        return promise;
    } else if (typeof timeoutMS === 'number') {
        let timeoutHandle = null;
        try {
            const timeoutSymbol = Symbol('timeout');
            const result = await Promise.race([
                promise,
                new Promise<typeof timeoutSymbol>(resolve => {
                    timeoutHandle = setTimeout(() => resolve(timeoutSymbol), timeoutMS)
                })
            ]);
            if (result === timeoutSymbol) {
                return await onTimeout();
            } else {
                return result;
            }
        } finally {
            if (timeoutHandle != null) {
                clearTimeout(timeoutHandle);
            }
        }
    } else {
        throw new Error('invalid timeout');
    }
}

export class TunnelConnection {
    private constructor(
        private serverInfo: ServerInfo
    ) {
    }

    private socket: net.Socket = null as any;
    private socketChannel: SocketChannel = null as any;

    private async establish(): Promise<void> {
        this.socket = net.connect({
            host: this.serverInfo.endpoint.host,
            port: this.serverInfo.endpoint.port,
            timeout: this.serverInfo.timeoutMS
        });
        await timeout(new Promise<void>((resolve, reject) => {
            let onError: (err: Error) => void, onConnect: () => void;
            this.socket
                .once('error', onError = err => {
                    this.socket.removeListener('connect', onConnect);
                    reject(new ConnectFailException(err.message));
                })
                .once('connect', onConnect = () => {
                    this.socket.removeListener('error', onError);
                    resolve();
                });
        }), this.serverInfo.timeoutMS, () => {
            this.socket.end();
            throw new TimeoutException();
        });
        this.socketChannel = new SocketChannel(this.socket);
    }

    private static async connect(serverInfo: ServerInfo): Promise<TunnelConnection> {
        const session = new TunnelConnection(serverInfo);
        serverInfo.close$?.then(() => {
            session.socket.end();
        });
        try {
            await session.establish();

            return await timeout(
                (async () => {
                    await session.socketChannel.extendedWriter.writeJSON(AuthRequestPacket, {
                        password: serverInfo.auth.password
                    });
                    const authResponse = await session.socketChannel.extendedReader.readJSON(AuthResponsePacket);

                    if (authResponse.type === 'success') {
                        return session;
                    } else if(authResponse.type === 'reject') {
                        throw new AuthFailException(authResponse.message);
                    } else {
                        throw new Error('bug.');
                    }
                }) (),
                serverInfo.timeoutMS,
                () => {
                    throw new TimeoutException();
                }
            );
        } catch (e) {
            session.socket.end();
            throw e;
        }
    }

    private static async join(joinInfo: JoinInfo): Promise<void> {
        const connection = await TunnelConnection.connect(joinInfo.server);

        try {
            await connection.socketChannel.extendedWriter.writeJSON(JoinRequestPacket, {
                type: 'join',
                socket: joinInfo.socket
            });

            const response = await connection.socketChannel.extendedReader.readJSON(JoinResponsePacket);

            if (response.type === 'joined') {
                const [source, initSource] = connection.socketChannel.leave();

                const destinationSocket = await connect(joinInfo.destination.host, joinInfo.destination.port);
                try {
                    destinationSocket.write(initSource);
                    await join(source, destinationSocket);
                } finally {
                    destinationSocket.end();
                }
            } else if (response.type === 'error') {
                throw new Error(response.message);
            } else {
                throw new Error('bug.');
            }

        } finally {
            connection.socket.end();
        }
    }

    static async check(serverInfo: ServerInfo): Promise<CheckResult> {
        try {
            const connection = await TunnelConnection.connect(serverInfo);
            connection?.socket.end();
        } catch (e) {
            if (e instanceof AuthFailException) {
                return CheckResult.AUTH_FAIL;
            } else if (e instanceof ConnectFailException) {
                return CheckResult.CONNECT_FAIL;
            } else if (e instanceof TimeoutException) {
                return CheckResult.TIMEOUT;
            } else {
                return CheckResult.UNEXPECTED;
            }
        }
        return CheckResult.OK;
    }

    static async listen(listenInfo: ListenInfo): Promise<TunnelConnection> {
        const connection = await TunnelConnection.connect(listenInfo.server);

        try {
            await connection.socketChannel.extendedWriter.writeJSON(
                ListenRequestPacket, {
                    type: 'listen',
                    host: listenInfo.source.host,
                    port: listenInfo.source.port,
                }
            );
            const response = await connection.socketChannel.extendedReader.readJSON(ListenResponsePacket);

            if (response.type === 'error') {
                throw new Error(response.message);
            } else if (response.type === 'bound') {

                listenInfo.onListening?.();

                (async () => {
                    while(true) {

                        const packet = await connection.socketChannel.extendedReader.readJSON(
                            IncomingConnectionPacket
                        );

                        if (packet.type === 'incoming') {

                            (async () => {
                                await TunnelConnection.join({
                                    server: listenInfo.server,
                                    destination: listenInfo.destination,
                                    socket: packet.socket
                                });
                            }) ().catch(reason => console.error(new Error(reason)));

                        } else {
                            throw new Error('bug.');
                        }

                    }
                }) () .catch(reason => console.error(new Error(reason)));

                return connection;

            } else {
                throw new Error('bug.');
            }
        } catch (e) {
            connection.socket.end();
            throw e;
        }
    }
}

export interface ServerInfo {
    timeoutMS?: number;
    close$?: Promise<void>;
    endpoint: Endpoint;
    auth: {
        password: string;
    }
}

export class ForwardSession extends Observable<ForwardStatus> {
    constructor(
        {
            server: {
                close$,
                ...server
            },
            onListening,
            ... listenInfo
        }: ListenInfo
    ) {
        super(subscriber => {
            let resolveClose: () => void;
            const serverInfo: ServerInfo = {
                ...server,
                close$: Promise.race([
                    new Promise<void>(resolve => {
                        resolveClose = resolve;
                    }),
                    close$
                ].filter(p => p != null))
            };

            subscriber.next({
                code: 'establishing'
            });

            const actualListenInfo = {
                server: serverInfo,
                onListening: () => {
                    subscriber.next({
                        code: 'listening'
                    });
                    onListening?.();
                },
                ...listenInfo
            };

            TunnelConnection.listen(actualListenInfo).then(
                () => subscriber.complete(),
                reason => subscriber.next({
                    code: 'error',
                    message: String(reason)
                })
            );

            return () => resolveClose();
        });
    }
}
