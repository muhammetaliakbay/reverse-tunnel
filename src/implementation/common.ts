import net from "net";
import {number, string} from '@muhammetaliakbay/structure-check';

export interface Endpoint {
    host: string;
    port: number;
}

export async function join(a: net.Socket,b: net.Socket): Promise<void> {
    try {
        const aClosePromise = new Promise<void>((resolve, reject) => {
            a.once('close', had_error => resolve());
            a.once('error', err => reject(err));
        });
        const bClosePromise = new Promise<void>((resolve, reject) => {
            b.once('close', had_error => resolve());
            b.once('error', err => reject(err));
        });

        a.pipe(b, {
            end: true
        });//.on('data', data => console.log('a', data));
        b.pipe(a, {
            end: true
        });//.on('data', data => console.log('b', data));

        await Promise.race([aClosePromise, bClosePromise]);
    } finally {
        a.end();
        b.end();
    }
}

export async function connect(host: string, port: number): Promise<net.Socket> {
    const socket = net.connect({
        host,
        port
    });

    await new Promise<void>((resolve, reject) => {
        let onError: (err: Error) => void, onConnect: () => void;
        socket
            .once('error', onError = err => {
                socket.removeListener('connect', onConnect);
                reject(err);
            })
            .once('connect', onConnect = () => {
                socket.removeListener('error', onError);
                resolve();
            });
    });

    return socket;
}
