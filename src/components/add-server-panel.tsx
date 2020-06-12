import React, {useEffect, useState} from 'react';
import {DuplicatedServerException, TunnelServer} from '../manager/tunnel-store';

import {
    Box,
    Button,
    Divider, Fade,
    Grid,
    Icon,
    InputAdornment,
    LinearProgress,
    Paper,
    TextField,
    Typography
} from '@material-ui/core';
import {parseAddress} from '../util/address';
import {CheckResult, defaultPort, TunnelConnection} from '../implementation/client';
import {useSnackbar} from 'notistack';
import {TunnelManager} from '../manager/tunnel-manager';

export function AddServerPanel({
    onAdd,
    tunnelManager
} : {
    tunnelManager: TunnelManager,
    onAdd: (server: TunnelServer) => void
}) {
    const [validating, setValidating] = useState(false);
    const [address, setAddress] = useState('');
    const [password, setPassword] = useState('');
    const [addressFieldError, setAddressFieldError] = useState<string | null>(null);
    const [passwordFieldError, setPasswordFieldError] = useState<string | null>(null);
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const addServer = async () => {
        setValidating(true);
        setAddressFieldError(null);
        setPasswordFieldError(null);

        const parsedAddress = parseAddress(address);
        if (parsedAddress === false) {
            setAddressFieldError('Invalid address');
        }
        if (password.length === 0) {
            setPasswordFieldError('Password can not be empty');
        }

        if (parsedAddress !== false && password.length > 0) {
            const checkResult = await TunnelConnection.check({
                endpoint: {
                    host: parsedAddress.host.text,
                    port: parsedAddress.port || defaultPort
                },
                auth: {
                    password: password
                },
                timeoutMS: 7500
            });

            switch (checkResult) {
                case CheckResult.OK:
                    let server: TunnelServer | null = null;
                    try {
                        server = await tunnelManager.tunnelStore.addServer(
                            parsedAddress.host.text,
                            parsedAddress.port || defaultPort,
                            password
                        );
                    } catch (e) {
                        if (e instanceof DuplicatedServerException) {
                            setAddressFieldError('Added already');
                        }
                        else {
                            setAddressFieldError('An unexpected error occurred');
                        }
                    }
                    if (server != null) {
                        enqueueSnackbar(<><Icon>add</Icon> &nbsp; Added server: &nbsp; <pre>{address}</pre></>);
                        onAdd(server);
                    }
                    break;
                case CheckResult.CONNECT_FAIL:
                    setAddressFieldError('Connection failed');
                    break;
                case CheckResult.AUTH_FAIL:
                    setPasswordFieldError('Authentication failed');
                    break;
                case CheckResult.TIMEOUT:
                    setAddressFieldError('Request timed out');
                    break;
                case CheckResult.UNEXPECTED:
                default:
                    setAddressFieldError('An unexpected error occurred');
                    break;
            }
        }

        setValidating(false);
    };
    return <Paper elevation={1}>
        <Box display='flex'
             flexDirection='column'
             alignItems='stretch' >

            <Box margin={2}>
                <Typography variant="h5">
                    Server Login
                </Typography>
            </Box>

            <Divider/>

            <Box margin={2}
                 display='flex'
                 flexDirection='column'
                 alignItems='center' >

                <Box margin={1}>
                    <TextField
                        disabled={validating}
                        variant='filled'
                        label='Server Address'
                        placeholder='addr.ess:1234'
                        error={addressFieldError !== null}
                        helperText={addressFieldError}
                        value={address}
                        onChange={event => setAddress(event.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Icon>public</Icon>
                                </InputAdornment>
                            ),
                        }} />
                </Box>

                <Box margin={1}>
                    <TextField
                        disabled={validating}
                        variant='filled'
                        label='Server Password'
                        required
                        type='password'
                        placeholder='SUpeRSecrE.T._Pwd-123'
                        error={passwordFieldError !== null}
                        helperText={passwordFieldError}
                        value={password}
                        onChange={event => setPassword(event.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Icon>vpn_key</Icon>
                                </InputAdornment>
                            ),
                        }} />
                </Box>
            </Box>

            <Fade
                in={!validating}
                style={{
                    transitionDelay: validating ? '0ms' : '500ms',
                }}
                unmountOnExit
            >
                <Divider/>
            </Fade>
            <Fade
                in={validating}
                style={{
                    transitionDelay: validating ? '500ms' : '0ms',
                }}
                unmountOnExit
            >
                <LinearProgress />
            </Fade>

            <Box margin={2}
                 alignSelf='flex-end' >
                <Button
                    disabled={validating}
                    onClick={addServer}
                    startIcon={<Icon>add</Icon>}
                    variant='contained' >
                    Add Server
                </Button>
            </Box>

        </Box>
    </Paper>;
}
