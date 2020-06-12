import {StructureChecker} from '@muhammetaliakbay/structure-check';

export class EOFException extends Error {}

export class BufferedReader {
    private stack: (Buffer | EOFException)[] = [];
    private queue: {
        buffer: Buffer;
        resolve(length: number): void;
        reject(err: any): void;
    } [] = [];

    read(buffer: Buffer): Promise<number> {
        if (buffer.length > 0) {
            if (this.stack.length > 0) {
                return new Promise<number>((resolve, reject) => {
                    let length: number;
                    try {
                        if (this.queue.length > 0) {
                            throw new Error('bug.');
                        }
                        const layer = this.stack[0];
                        if (layer instanceof EOFException) {
                            throw layer;
                        }
                        length = Math.min(buffer.length, layer.length);
                        const layerNext = layer.subarray(length);
                        if (layerNext.length > 0) {
                            this.stack[0] = layerNext;
                        } else {
                            this.stack.splice(0, 1);
                        }
                        layer.copy(
                            buffer, 0, 0, length
                        );
                    } catch (e) {
                        reject(e);
                        return;
                    }
                    resolve(length);
                });
            } else {
                return new Promise<number>((resolve, reject) => {
                    this.queue.push({
                        buffer,
                        resolve,
                        reject
                    });
                    this.notify();
                });
            }
        } else {
            return Promise.resolve(0);
        }
    }

    push(buffer: Buffer) {
        if (buffer.length > 0) {
            const clone = Buffer.allocUnsafe(buffer.length);
            buffer.copy(clone);

            this.stack.push(clone);

            this.notify();
        }
    }

    end(): void {
        this.stack.push(new EOFException());
        this.notify();
    }

    notify(): void {
        while (this.stack.length > 0 && this.queue.length > 0) {
            const q = this.queue.splice(0, 1)[0];
            const layer = this.stack[0];
            if (layer instanceof EOFException) {
                q.reject(layer);
                continue;
            }
            const length = Math.min(q.buffer.length, layer.length);
            const layerNext = layer.subarray(length);
            if (layerNext.length > 0) {
                this.stack[0] = layerNext;
            } else {
                this.stack.splice(0, 1);
            }
            layer.copy(
                q.buffer, 0, 0, length
            );
            try {
                q.resolve(length);
            } catch (e) {
                console.error(new Error(e));
            }
        }

    }

    leave(): Buffer {
        const eof = this.stack.find(layer => layer instanceof EOFException);
        if (eof != null) {
            throw eof;
        }
        const total = Buffer.concat(
            this.stack as Buffer[]
        );
        this.stack.splice(0, this.stack.length);
        return total;
    }
}

export class ExtendedReader {
    constructor(readonly source: BufferedReader) {
    }

    async readBytes(length: number): Promise<Buffer> {
        const buffer = Buffer.allocUnsafe(length);

        let left = length;
        let offset = 0;

        while(left > 0) {
            const readed = await this.source.read(buffer.subarray(offset, offset + left));
            left -= readed;
            offset += readed;
        }

        return buffer;
    }

    async readJSON<T>(checker: StructureChecker<T>): Promise<T>{
        const data = JSON.parse(await this.readUTF8Blob());
        if (checker(data)) {
            return data;
        } else {
            throw new Error('invalid data doesn\'t fit into specified structure');
        }
    }

    async readBlob(): Promise<Buffer> {
        const length = await this.readUInt16LE();
        return await this.readBytes(length);
    }

    async readUTF8Blob(): Promise<string> {
        return (await this.readBlob()).toString('utf8');
    }

    async readInt8(): Promise<number> {
        return (await this.readBytes(1)).readInt8(0);
    }
    async readUInt8(): Promise<number> {
        return (await this.readBytes(1)).readUInt8(0);
    }

    async readUInt16LE(): Promise<number> {
        return (await this.readBytes(2)).readUInt16LE(0);
    }
    async readUInt16BE(): Promise<number> {
        return (await this.readBytes(2)).readUInt16BE(0);
    }

    async readInt16LE(): Promise<number> {
        return (await this.readBytes(2)).readInt16LE(0);
    }
    async readInt16BE(): Promise<number> {
        return (await this.readBytes(2)).readInt16BE(0);
    }

    async readUInt32LE(): Promise<number> {
        return (await this.readBytes(4)).readUInt32LE(0);
    }
    async readUInt32BE(): Promise<number> {
        return (await this.readBytes(4)).readUInt32BE(0);
    }

    async readInt32LE(): Promise<number> {
        return (await this.readBytes(4)).readInt32LE(0);
    }
    async readInt32BE(): Promise<number> {
        return (await this.readBytes(4)).readInt32BE(0);
    }


}
