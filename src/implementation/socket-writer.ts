import * as net from 'net';
import {StructureChecker} from '@muhammetaliakbay/structure-check';

export class SocketWriter {
    constructor(readonly socket: net.Socket) {
    }

    writeBytes(buffer: Buffer): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (!this.socket.write(buffer, err => {
                if (err == null) {
                    resolve();
                } else {
                    reject(err);
                }
            })) {
                reject(new Error('couldn\'t write'));
            }
        });
    }
}

export class ExtendedWriter {
    constructor(readonly source: SocketWriter) {
    }

    writeBytes(buffer: Buffer): Promise<void> {
        return this.source.writeBytes(buffer);
    }

    async writeJSON<T>(checker: StructureChecker<T>, data: T): Promise<void>{
        if (checker(data)) {
            await this.writeUTF8Blob(JSON.stringify(data));
        } else {
            throw new Error('outgoing data doesn\'t fit into specified structure');
        }
    }

    async writeBlob(blob: Buffer): Promise<void> {
        if (blob.length > 0x0FFFF) {
            throw new Error('Blob length can not be larger than ' + blob.length + ' bytes');
        }
        await this.writeUInt16LE(blob.length);
        await this.writeBytes(blob);
    }

    async writeUTF8Blob(text: string): Promise<void> {
        await this.writeBlob(Buffer.from(text, 'utf8'));
    }

    async writeInt8(val: number): Promise<void> {
        const buffer = Buffer.allocUnsafe(1);
        buffer.writeInt8(val, 0);
        await this.writeBytes(buffer);
    }
    async writeUInt8(val: number): Promise<void> {
        const buffer = Buffer.allocUnsafe(1);
        buffer.writeInt8(val, 0);
        await this.writeBytes(buffer);
    }

    async writeInt16LE(val: number): Promise<void> {
        const buffer = Buffer.allocUnsafe(2);
        buffer.writeInt16LE(val, 0);
        await this.writeBytes(buffer);
    }
    async writeInt16BE(val: number): Promise<void> {
        const buffer = Buffer.allocUnsafe(2);
        buffer.writeInt16BE(val, 0);
        await this.writeBytes(buffer);
    }

    async writeUInt16LE(val: number): Promise<void> {
        const buffer = Buffer.allocUnsafe(2);
        buffer.writeUInt16LE(val, 0);
        await this.writeBytes(buffer);
    }
    async writeUInt16BE(val: number): Promise<void> {
        const buffer = Buffer.allocUnsafe(2);
        buffer.writeUInt16BE(val, 0);
        await this.writeBytes(buffer);
    }

    async writeInt32LE(val: number): Promise<void> {
        const buffer = Buffer.allocUnsafe(4);
        buffer.writeInt32LE(val, 0);
        await this.writeBytes(buffer);
    }
    async writeInt32BE(val: number): Promise<void> {
        const buffer = Buffer.allocUnsafe(4);
        buffer.writeInt32BE(val, 0);
        await this.writeBytes(buffer);
    }

    async writeUInt32LE(val: number): Promise<void> {
        const buffer = Buffer.allocUnsafe(4);
        buffer.writeUInt32LE(val, 0);
        await this.writeBytes(buffer);
    }
    async writeUInt32BE(val: number): Promise<void> {
        const buffer = Buffer.allocUnsafe(4);
        buffer.writeUInt32BE(val, 0);
        await this.writeBytes(buffer);
    }
}
