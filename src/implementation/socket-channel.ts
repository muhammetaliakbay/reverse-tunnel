import * as net from 'net';
import {BufferedReader, ExtendedReader} from './buffered-reader';
import {ExtendedWriter, SocketWriter} from './socket-writer';

export class SocketChannel {
    private readonly onData: (data: Buffer) => void;
    private readonly onClose: (had_error: boolean) => void;
    private readonly onError: (error: any) => void;
    constructor(
        readonly socket: net.Socket
    ) {
        this.socket.on('data', this.onData = data => {
            this.reader.push(data);
        });
        this.socket.once('close', this.onClose = had_error => {
            this.socket.removeListener('data', this.onData);
            this.socket.removeListener('error', this.onError);
        });
        this.socket.once('error', this.onError = error => {
            this.socket.removeListener('data', this.onData);
            this.socket.removeListener('close', this.onClose);
        });
    }

    leave(): [net.Socket, Buffer] {
        this.socket.removeListener('data', this.onData);
        this.socket.removeListener('close', this.onClose);
        this.socket.removeListener('error', this.onError);

        return [
            this.socket,
            this.reader.leave()
        ];
    }

    readonly reader = new BufferedReader();
    readonly extendedReader = new ExtendedReader(this.reader);
    readonly writer = new SocketWriter(this.socket);
    readonly extendedWriter = new ExtendedWriter(this.writer);
}
