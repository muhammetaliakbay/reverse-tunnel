import {render} from 'react-dom';
import {MiddleGateWindow} from './components/window';
import React from 'react';
import os from 'os';
import path from 'path';

import {createTunnelStore} from './manager/tunnel-store';

const content = document.querySelector("#content");
import './index.scss';
import {SnackbarProvider} from 'notistack';
import {TunnelManager} from './manager/tunnel-manager';

const configPath = path.resolve(os.homedir(), 'reverse-tunnel.config.json');

(async () => {
    const tunnelStore = await createTunnelStore(configPath);

    /*const tunnelServer0 = await tunnelStore.addServer(
        'reverse.tun.nel', 1234, 'SUPERSECRETPASSWORD123'
    );
    const tunnelServer1 = await tunnelStore.addServer(
        '123.45.67.89', 4321, '1234567'
    );

    await tunnelStore.addForwardRule(
        tunnelServer0,
        '0.0.0.0', 80,
        'localhost', 10080
    );
    await tunnelStore.addForwardRule(
        tunnelServer0,
        '0.0.0.0', 443,
        '127.0.0.1', 10443
    );
    await tunnelStore.addForwardRule(
        tunnelServer1,
        '0.0.0.0', 22,
        '127.0.0.1', 22
    );*/

    const tunnelManager = new TunnelManager(
        tunnelStore
    );

    render(<SnackbarProvider maxSnack={3}>
        <MiddleGateWindow tunnelManager={tunnelManager} />
    </SnackbarProvider>, content);

}) ().catch(reason => console.error('error in index entry', reason));

process.on('uncaughtException', error =>
    console.error('uncaughtException on index', error)
);
process.on('unhandledRejection', reason =>
    console.error('unhandledRejection on index', reason)
);
