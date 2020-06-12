import yargs from 'yargs';
import {Server} from '../implementation/server';
import {TunnelConnection} from '../implementation/client';

function handle<ARGV>(handler: (argv: ARGV) => void | Promise<void>): (argv: ARGV) => void {
    return ((argv: ARGV) => {
        new Promise(async(resolve, reject) => {
            try {
                resolve(handler(argv));
            } catch (e) {
                reject(e);
            }
        }).catch(reason => console.error(new Error(reason)));
    });
}

yargs
    .scriptName('reverse-tunnel')

    .string('password').demandOption('password')
    .string('host').demandOption('host').default('host', '0.0.0.0')
    .number('port').demandOption('port').default('port', 1234)

    .command('serve','Start serving for reverse-tunnel',
    yargs => yargs,
    async argv => {
            const server = new Server({
                auth: {
                    password: argv.password
                },
                endpoint: {
                    host: argv.host,
                    port: argv.port
                }
            });
            await server.serve();
        })

    .command('listen','Listen reverse-tunnel',
    yargs => (
        yargs
            .string('source-host').demandOption('source-host').default('source-host', '0.0.0.0')
            .number('source-port').demandOption('source-port')
            .string('destination-host').demandOption('destination-host').default('destination-host', '127.0.0.1')
            .number('destination-port').demandOption('destination-port')
    ),
    async argv => {
            await TunnelConnection.listen({
                source: {
                    host: argv['source-host'],
                    port: argv['source-port']
                },
                destination: {
                    host: argv['destination-host'],
                    port: argv['destination-port']
                },
                server: {
                    auth: {
                        password: argv.password
                    },
                    endpoint: {
                        host: argv.host,
                        port: argv.port
                    }
                }
            });
        })

    .demandCommand(1, 1)
    .help()
    .argv;
