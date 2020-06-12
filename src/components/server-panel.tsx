import React, {useEffect, useState} from 'react';
import {
    FlatTunnelServer,
    FlatTunnelServerSelf,
    ForwardRule,
    TunnelServer
} from '../manager/tunnel-store';
import {combineLatest, Observable, Subscription} from 'rxjs';
import {ForwardTable} from './forward-table';
import {Endpoint} from '../implementation/common';
import {Box} from '@material-ui/core';
import {defaultPort} from '../implementation/client';
import {TunnelManager} from '../manager/tunnel-manager';

export function ServerTabLabel ({
    tunnelServer
} : {
    tunnelServer: TunnelServer
}) {
    const [serverInfo, setServerInfo] = useState<FlatTunnelServerSelf>();
    const [subscription, setSubscription] = useState<Subscription>();
    useEffect(() => {
        setSubscription(tunnelServer.flatSelf$.subscribe(setServerInfo));
        return () => subscription?.unsubscribe();
    }, [tunnelServer]);

    return <>{serverInfo?.host + (serverInfo?.port === defaultPort ? '' : ':' + serverInfo?.port)}</>;
}

export function ServerPanel({
    tunnelServer,
    tunnelManager,
} : {
    tunnelServer: TunnelServer,
    tunnelManager: TunnelManager
}) {
    const [serverInfo, setServerInfo] = useState<FlatTunnelServerSelf>();
    const [subscription, setSubscription] = useState<Subscription>();
    useEffect(() => {
        setSubscription(tunnelServer.flatSelf$.subscribe(setServerInfo));
        return () => subscription?.unsubscribe();
    }, [tunnelServer]);

    return <Box>
        {serverInfo && <ForwardTable tunnelManager={tunnelManager} tunnelServer={tunnelServer} />}
    </Box>;
}
