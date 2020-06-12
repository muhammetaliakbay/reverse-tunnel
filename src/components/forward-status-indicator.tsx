import {ForwardRule} from '../manager/tunnel-store';
import {ExtendedForwardStatus, TunnelManager} from '../manager/tunnel-manager';
import React, {useEffect, useState} from 'react';
import {Subscription} from 'rxjs';
import {CircularProgress, Icon, Paper, Popper, Theme, Tooltip, withStyles, Zoom} from '@material-ui/core';

const StatusTooltip = withStyles((theme: Theme) => ({
    tooltip: {
        fontSize: 14,
    },
}))(Tooltip);

export function ForwardStatusIndicator({
    forwardRule,
    tunnelManager
}: {
    forwardRule: ForwardRule,
    tunnelManager: TunnelManager
}) {
    const [status, setStatus] = useState<ExtendedForwardStatus>();

    const [statusSubscription, setStatusSubscription] = useState<Subscription>();
    useEffect(() => {
        if (forwardRule != null && tunnelManager != null) {
            setStatusSubscription(tunnelManager.observeStatus(forwardRule).subscribe(setStatus));
            return () => statusSubscription?.unsubscribe();
        }
    }, [forwardRule, tunnelManager]);

    let icon;
    let message;

    if (status != null) {
        if (status.code === 'establishing') {
            icon = <CircularProgress size={24} />;
            message = 'Establishing...';
        } else if (status.code === 'listening') {
            icon = <Icon>check</Icon>;
            message = 'Listening';
        } else if (status.code === 'error') {
            icon = <Icon>error</Icon>;
            message = status.message;
        }
    }

    return <>{
        icon != null && message != null && (
            <StatusTooltip TransitionComponent={Zoom}
                           arrow
                           interactive
                           title={message}>
                {icon}
            </StatusTooltip>
        )
    }</>;
}
