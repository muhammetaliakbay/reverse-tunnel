import {number, object, string, StructureChecker} from '@muhammetaliakbay/structure-check';
import * as net from 'net';
import {SocketChannel} from './socket-channel';
import {
    AuthRejectResponsePacket,
    AuthRequestPacket,
    AuthSuccessResponsePacket, ErrorResponsePacket, IncomingConnectionPacket, JoinedResponsePacket,
    ListenResponsePacket,
    RequestPacket
} from './packets';
import {randomBytes} from 'crypto';
import {join} from './common';

export const ServerConfiguration = object({
    endpoint: object({
        host: string(),
        port: number()
    }),
    auth: object({
        password: string()
    })
});
export type ServerConfigurationType = typeof ServerConfiguration extends StructureChecker<infer T> ? T : never;

interface Binding {
    close(): void;
    accept(): Promise<net.Socket | null>;
    readonly close$: Promise<void>;
}
async function listen(host: string, port: number): Promise<Binding> {
    const serverSocket = net
        .createServer({})
        .listen(port, host);

    await new Promise<void>((resolve, reject) => {
        let onError: (err: Error) => void, onListening: () => void;
        serverSocket
            .once('error', onError = err => {
                serverSocket.removeListener('listening', onListening);
                reject(err);
            })
            .once('listening', onListening = () => {
                serverSocket.removeListener('error', onError);
                resolve();
            });
    });

    const socketQueue: net.Socket[] = [];
    const acceptQueue: {resolve(socket: net.Socket | null): void; reject(err: any): void;} [] = [];
    const close$ = new Promise<void>(resolve => {
        let onConnection: (socket: net.Socket) => void;
        serverSocket.on('connection', onConnection = socket => {
            if (acceptQueue.length > 0) {
                const promise = acceptQueue.splice(0, 1)[0];
                promise.resolve(socket);
            } else {
                socketQueue.push(socket);
            }
        });

        serverSocket.once('close', () => {
            serverSocket.removeListener('connection', onConnection);
            for(const queue of acceptQueue) {
                try {
                    queue.resolve(null);
                } catch (e) {
                    console.error(e);
                }
            }
            resolve();
        });
    });

    return {
        async accept(): Promise<net.Socket | null> {
            if (!serverSocket.listening) {
                throw new Error('server is closed');
            } else if (socketQueue.length > 0) {
                return socketQueue.splice(0, 1)[0];
            } else {
                return new Promise<net.Socket | null>((resolve, reject) => {
                    acceptQueue.push({
                        resolve,
                        reject
                    });
                });
            }
        },
        close() {
            serverSocket.close();
        },
        close$
    };
}

interface IncomingSocket {
    identity: string;
    socket: net.Socket;
    secret: string;
}
export class Server {
    constructor(
        readonly config: ServerConfigurationType
    ) {
        ServerConfiguration.cast(config);
    }

    private nextIdentityIndex: number = 0;

    private queue: {[identity: string]: IncomingSocket & {free: () => void}} = {};
    private pushQueue(socket: net.Socket): IncomingSocket {
        const identity = `#${this.nextIdentityIndex++}`;
        const secret = randomBytes(64).toString('base64');

        let onClose: (has_error: boolean) => void;
        let onError: (err: any) => void;

        const free = () => {
            delete this.queue[identity];
            socket.removeListener('close', onClose);
            socket.removeListener('error', onError);
        };

        socket.once('close', onClose = had_error => {
            free();
        });
        socket.once('error', onError = err => {
            free();
        });
        return this.queue[identity] = {
            identity,
            secret,
            socket,
            free
        };
    }
    private pullQueue(identity: string, secret: string): IncomingSocket | null | false {
        const entry = this.queue[identity];
        if (entry == null) {
            return null;
        } else if (entry.secret === secret) {
            entry.free();
            return entry;
        } else {
            return false;
        }
    }

    async serve(): Promise<void> {
        const binding = await listen(this.config.endpoint.host, this.config.endpoint.port);

        try {
            let socket: net.Socket | null;
            while ((socket = await binding.accept()) != null) {
                this.greet(socket).catch(reason => console.error(new Error(reason)));
            }
        } finally {
            binding.close();
        }
    }

    private async greet(socket: net.Socket): Promise<void> {
        try {
            const channel = new SocketChannel(socket);
            const authRequest = await channel.extendedReader.readJSON(AuthRequestPacket);
            if (authRequest.password !== this.config.auth.password) {
                await channel.extendedWriter.writeJSON(AuthRejectResponsePacket, {
                    type: 'reject',
                    message: 'Authorization failed'
                });
            } else {
                await channel.extendedWriter.writeJSON(AuthSuccessResponsePacket, {
                    type: 'success'
                });

                const requestPacket = await channel.extendedReader.readJSON(RequestPacket);

                if (requestPacket.type === 'listen') {

                    let binding: Binding;
                    try {
                        binding = await listen(requestPacket.host, requestPacket.port);
                    } catch (e) {
                        await channel.extendedWriter.writeJSON(ListenResponsePacket, {
                            type: 'error',
                            message: e.toString()
                        });
                        return;
                    }

                    try {
                        socket.once('close', had_error => {
                            binding.close();
                        });
                        socket.once('error', err => {
                            binding.close();
                        });

                        await channel.extendedWriter.writeJSON(ListenResponsePacket, {
                            type: 'bound'
                        });

                        let child: net.Socket | null;
                        while ((child = await binding.accept()) != null) {
                            const entry = this.pushQueue(child);
                            await channel.extendedWriter.writeJSON(IncomingConnectionPacket, {
                                type: 'incoming',
                                socket: {
                                    identity: entry.identity,
                                    token: entry.secret
                                }
                            });
                        }
                    } finally {
                        binding.close();
                    }

                } else if(requestPacket.type === 'join') {

                    const entry = this.pullQueue(
                        requestPacket.socket.identity,
                        requestPacket.socket.token
                    );

                    if (entry == null) {
                        await channel.extendedWriter.writeJSON(ErrorResponsePacket, {
                            type: 'error',
                            message: 'Socket not found'
                        });
                    } else if (entry === false) {
                        await channel.extendedWriter.writeJSON(ErrorResponsePacket, {
                            type: 'error',
                            message: 'Access denied'
                        });
                    } else {
                        try {
                            await channel.extendedWriter.writeJSON(JoinedResponsePacket, {
                                type: 'joined'
                            });

                            const [source, initSource] = channel.leave();
                            entry.socket.write(initSource);
                            await join(source, entry.socket);
                        } finally {
                            entry.socket.end();
                        }
                    }

                } else {
                    throw new Error('bug.');
                }
            }
        } finally {
            socket.end();
        }
    }
}
