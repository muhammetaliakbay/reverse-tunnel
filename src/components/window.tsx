import React, {useEffect, useState} from 'react';

import {TunnelServer} from '../manager/tunnel-store';
import {Subscription} from 'rxjs';
import {map} from 'rxjs/operators';
import {ServerPanel, ServerTabLabel} from './server-panel';

/*new Titlebar({
    backgroundColor: Color.fromHex('#6c6c6c'),
    menu: null,
    titleHorizontalAlignment: 'left',
});*/

import {
    Icon,
    Tab,
    Theme,
    Tabs,
    Grid,
    makeStyles,
    AppBar,
    Box,
    Toolbar,
    IconButton,
    Slide,
    Grow
} from '@material-ui/core';
import {AddServerPanel} from './add-server-panel';
import {DeleteButton} from './delete-button';
import {ForwardTable} from './forward-table';
import {useSnackbar} from 'notistack';
import {TunnelManager} from '../manager/tunnel-manager';

const styles = makeStyles((theme: Theme) => ({
    'window': {
        height: '100%',
    },
    'tab-list': {
        // borderRight: `1px solid ${theme.palette.divider}`,
        // height: '100%'
    },
}));

export const MiddleGateWindow = ({
    tunnelManager
} : {
    tunnelManager: TunnelManager
}) => {
    const [servers, setServers] = useState<TunnelServer[]>(() => []);
    const [subscription, setSubscription] = useState<Subscription>();
    useEffect(() => {
        setSubscription(
            tunnelManager.tunnelStore.servers$.subscribe( setServers)
        );
        return () => {
            subscription?.unsubscribe();
        };
    }, [tunnelManager]);
    const [viewingServerState, setViewingServer] = useState<TunnelServer | null>();

    let viewingServer = (viewingServerState === undefined ? servers[0] : viewingServerState) || null;
    if (viewingServer !== null && !servers.includes(viewingServer)) {
        viewingServer = null;
    }

    const { enqueueSnackbar, closeSnackbar } = useSnackbar();

    const deleteServer = async (server: TunnelServer) => {
        await tunnelManager.tunnelStore.removeServer(server);
        enqueueSnackbar(<><Icon>delete</Icon> &nbsp; Deleted server</>);
    };

    const classes = styles();

    return <Box display='flex' flexDirection='column' >
        <AppBar position="static" color="primary">
            <Tabs className={classes['tab-list']} onChange={(event, viewingServer) => setViewingServer(viewingServer)}
                  variant='scrollable'
                  scrollButtons='auto'
                  value={viewingServer}>
                {servers.map(server =>
                    <Tab key={server.identity} value={server} label={
                        <ServerTabLabel tunnelServer={server}/>
                    } />
                )}
                <Tab value={null} icon={<Icon>add</Icon>}/>
            </Tabs>
        </AppBar>
        {
            viewingServer !== null &&
            <Box display='flex' flexDirection='column'>
                <Grow in>
                    <AppBar position='static' color='default'>
                        <Toolbar>
                            <DeleteButton
                                label='Delete server'
                                onConfirm={() => deleteServer(viewingServer!).catch(
                                    reason => console.error('error while deleting server', reason)
                                )} />
                        </Toolbar>
                    </AppBar>
                </Grow>
                <ServerPanel tunnelServer={viewingServer}
                             tunnelManager={tunnelManager} />
            </Box>
        }
        {
            viewingServer !== null ||
            <Box alignSelf='center' marginTop={3}>
                <AddServerPanel onAdd={setViewingServer} tunnelManager={tunnelManager} />
            </Box>
        }
    </Box>;
};
