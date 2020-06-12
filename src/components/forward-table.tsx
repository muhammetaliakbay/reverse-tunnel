import React, {useEffect, useState} from 'react';

import {Endpoint} from '../implementation/common';
import {FlatForwardRule, ForwardRule, TunnelServer, TunnelStore} from '../manager/tunnel-store';
import {Subscription, combineLatest, Observable} from 'rxjs';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Icon,
    IconButton,
    TextField, CircularProgress
} from '@material-ui/core';
import {DeleteButton} from './delete-button';
import {makeStyles} from '@material-ui/core/styles';
import {parseHost, parsePort} from '../util/address';
import {ExtendedForwardStatus, TunnelManager} from '../manager/tunnel-manager';
import {ForwardStatusIndicator} from './forward-status-indicator';

const useStyles = makeStyles(theme => ({
    portCell: {
        width: '64px',
    },
    hostCell: {
        width: '96px'
    },
    arrowCell: {
        width: '24px'
    },
    statusCell: {
        width: '24px'
    }
}));

interface ErrorTarget {
    (errorMessage: string | null): void;
}

const defaultSourceHost = '0.0.0.0';
const defaultDestinationHost = '127.0.0.1';

function validatePort(port: number | string | undefined, target: ErrorTarget): boolean {
    if (port == null || (typeof port === 'string' && port.trim().length === 0)) {
        target('Port is required');
        return false;
    } else if(parsePort(port) === false) {
        target('Not valid port');
        return false;
    } else {
        target(null);
        return true;
    }
}

function validateHost(host: string | undefined, target: ErrorTarget): boolean {
    if (host == null) {
        target('Host is required');
        return false;
    } else if(parseHost(host) === false) {
        target('Not valid host');
        return false;
    } else {
        target(null);
        return true;
    }
}

export const ForwardRow = ({
    forwardRule,
    tunnelServer,
    tunnelManager
} : {
    forwardRule?: ForwardRule,
    tunnelServer: TunnelServer,
    onRuleAdded?: () => void,
    tunnelManager?: TunnelManager
}) => {
    const styles = useStyles();

    const [ruleInfo, setRuleInfo] = useState<FlatForwardRule>();

    const [infoSubscription, setInfoSubscription] = useState<Subscription>();
    useEffect(() => {
        if (forwardRule != null) {
            setInfoSubscription(forwardRule.flat$.subscribe(setRuleInfo));
            return () => infoSubscription?.unsubscribe();
        }
    }, [forwardRule]);


    const [editingState, setEditing] = useState(false);

    const editing = editingState || forwardRule == null;

    const deleteRule = () => {
        tunnelServer.tunnelStore.removeForwardRule(
            forwardRule!
        ).catch(reason => console.log('error while deleting rule', forwardRule));
    };

    const [sourceHost, setSourceHost] = useState<string>();
    const [sourcePort, setSourcePort] = useState<string>();
    const [destinationHost, setDestinationHost] = useState<string>();
    const [destinationPort, setDestinationPort] = useState<string>();

    const [sourceHostError, setSourceHostError] = useState<string | null>();
    const [sourcePortError, setSourcePortError] = useState<string | null>();
    const [destinationHostError, setDestinationHostError] = useState<string | null>();
    const [destinationPortError, setDestinationPortError] = useState<string | null>();

    useEffect(() => {
        if (!editing || sourceHost == null) {
            setSourceHost(ruleInfo?.sourceHost);
        }
        if (!editing || sourcePort == null) {
            setSourcePort(ruleInfo?.sourcePort?.toString());
        }

        if (!editing || destinationHost == null) {
            setDestinationHost(ruleInfo?.destinationHost);
        }
        if (!editing || destinationPort == null) {
            setDestinationPort(ruleInfo?.destinationPort?.toString());
        }
    }, [editing, ruleInfo]);

    const editCancel = () => {
        setEditing(false);
    };

    const editDone = () => {
        let valid = validateHost(sourceHost || defaultSourceHost, setSourceHostError);
        valid = validatePort(sourcePort, setSourcePortError) && valid;
        valid = validateHost(destinationHost || defaultDestinationHost, setDestinationHostError) && valid;
        valid = validatePort(destinationPort, setDestinationPortError) && valid;

        if (valid) {
            if (forwardRule == null) {
                tunnelServer.tunnelStore.addForwardRule(
                    tunnelServer,
                    sourceHost || defaultSourceHost, Number(sourcePort),
                    destinationHost || defaultDestinationHost, Number(destinationPort)
                ).catch(reason => console.log('error while adding rule', reason));
            } else {
                setEditing(false);
                tunnelServer.tunnelStore.updateForwardRule(
                    forwardRule,
                    {
                        sourceHost,
                        sourcePort: Number(sourcePort),
                        destinationHost,
                        destinationPort: Number(destinationPort)
                    }
                );
            }
        }
    };


    return <TableRow>
        <TableCell className={styles.statusCell}>
            {
                forwardRule != null && tunnelManager != null &&
                <ForwardStatusIndicator forwardRule={forwardRule} tunnelManager={tunnelManager} />
            }
        </TableCell>
        <TableCell className={styles.hostCell}>
            {
                editing ? <TextField
                    variant='outlined'
                    margin='dense'
                    value={sourceHost}
                    error={sourceHostError != null}
                    helperText={sourceHostError}
                    placeholder={defaultSourceHost}
                    onChange={event => setSourceHost(event.target.value)} /> : sourceHost
            }
        </TableCell>
        <TableCell className={styles.portCell}>
            {
                editing ? <TextField
                    variant='outlined'
                    margin='dense'
                    value={sourcePort}
                    error={sourcePortError != null}
                    helperText={sourcePortError}
                    onChange={event => setSourcePort(event.target.value)} /> : sourcePort
            }
        </TableCell>
        <TableCell className={styles.arrowCell}>
            <Icon>arrow_right_alt</Icon>
        </TableCell>
        <TableCell className={styles.hostCell}>
            {
                editing ? <TextField
                    variant='outlined'
                    margin='dense'
                    value={destinationHost}
                    error={destinationHostError != null}
                    helperText={destinationHostError}
                    placeholder={defaultDestinationHost}
                    onChange={event => setDestinationHost(event.target.value)} /> : destinationHost
            }
        </TableCell>
        <TableCell className={styles.portCell}>
            {
                editing ? <TextField
                    variant='outlined'
                    margin='dense'
                    value={destinationPort}
                    error={destinationPortError != null}
                    helperText={destinationPortError}
                    onChange={event => setDestinationPort(event.target.value)} /> : destinationPort
            }
        </TableCell>
        <TableCell>
            {
                !editing ? <>
                    <DeleteButton onConfirm={deleteRule} />
                    <IconButton onClick={() => setEditing(true)}>
                        <Icon>edit</Icon>
                    </IconButton>
                </> : <>
                    <IconButton onClick={editDone}>
                        <Icon>{
                            forwardRule == null ? 'add' : 'done'
                        }</Icon>
                    </IconButton>
                    {
                        forwardRule != null && <IconButton onClick={editCancel}>
                            <Icon>close</Icon>
                        </IconButton>
                    }
                </>
            }
        </TableCell>
    </TableRow>;
};

export const ForwardTable = ({
    tunnelServer,
    tunnelManager
} : {
    tunnelServer: TunnelServer,
    tunnelManager: TunnelManager
}) => {
    const styles = useStyles();

    const [forwardRules, setForwardRules] = useState<ForwardRule[]>([]);
    const [subscription, setSubscription] = useState<Subscription>();
    useEffect(() => {
        setSubscription(tunnelServer.forwardRules$.subscribe(setForwardRules));
        return () => subscription?.unsubscribe();
    }, [tunnelServer]);

    return <TableContainer className='forward-table'>
        <Table stickyHeader>
            <TableHead>
                <TableRow>
                    <TableCell className={styles.statusCell} />
                    <TableCell className={styles.hostCell}>
                        Host
                    </TableCell>
                    <TableCell className={styles.portCell}>
                        Port
                    </TableCell>
                    <TableCell className={styles.arrowCell}>
                        <Icon>arrow_right_alt</Icon>
                    </TableCell>
                    <TableCell className={styles.hostCell}>
                        Host
                    </TableCell>
                    <TableCell className={styles.portCell}>
                        Port
                    </TableCell>
                    <TableCell/>
                </TableRow>
            </TableHead>
            <TableBody>
                {forwardRules.map(
                    rule => <ForwardRow key={rule.identity}
                                        tunnelManager={tunnelManager}
                                        tunnelServer={tunnelServer}
                                        forwardRule={rule} />
                )}
                <ForwardRow tunnelServer={tunnelServer} />
            </TableBody>
        </Table>
    </TableContainer>;
};
