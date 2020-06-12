import {Box, Button, Icon, IconButton, Popover} from '@material-ui/core';
import React, {useState} from 'react';

export function DeleteButton({
    disabled = false,
    label,
    onConfirm
}: {
    label?: any,
    disabled?: boolean,
    onConfirm: () => void
}) {
    const [opened, setOpened] = useState(false);

    const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null);

    return <>
        {
            label ? <Button
                startIcon={<Icon>delete</Icon>}
                disabled={disabled}
                onClick={(event) => {setOpened(true); setAnchorEl(event.currentTarget);}} >
                {label}
            </Button> : <IconButton
                disabled={disabled}
                onClick={(event) => {setOpened(true); setAnchorEl(event.currentTarget);}} >
                <Icon>delete</Icon>
            </IconButton>
        }
        <Popover 
            open={opened && !disabled}
            anchorEl={anchorEl} 
            onClose={() => setOpened(false)} >
            <Box padding={2}>
                Are you sure to&nbsp;
                <Button
                    onClick={() => {
                        setOpened(false);
                        onConfirm();
                    }}
                    variant='outlined' 
                    startIcon={<Icon>delete</Icon>} >delete?</Button>
            </Box>
        </Popover>
    </>;
}
