import {constant, number, object, optional, or, string} from '@muhammetaliakbay/structure-check';

export const AuthRequestPacket = object({
    password: string()
});
export const AuthRejectResponsePacket = object({
    type: constant<'reject'>('reject'),
    message: string()
});
export const AuthSuccessResponsePacket = object({
    type: constant<'success'>('success')
});
export const AuthResponsePacket = or(
    AuthRejectResponsePacket,
    AuthSuccessResponsePacket
);
export const BoundResponsePacket = object({
    type: constant<'bound'>('bound')
});

export const ListenRequestPacket = object({
    type: constant<'listen'>('listen'),
    host: string(),
    port: number()
});
export const JoinRequestPacket = object({
    type: constant<'join'>('join'),
    socket: object({
        identity: string(),
        token: string()
    }),
});
export const JoinedResponsePacket = object({
    type: constant<'joined'>('joined')
});

export const ErrorResponsePacket = object({
    type: constant<'error'>('error'),
    message: string()
});

export const IncomingConnectionPacket = object({
    type: constant<'incoming'>('incoming'),
    socket: object({
        identity: string(),
        token: string()
    }),
});

export const ListenResponsePacket = or(
    BoundResponsePacket,
    ErrorResponsePacket
);

export const JoinResponsePacket = or(
    JoinedResponsePacket,
    ErrorResponsePacket
);

export const RequestPacket = or(
    ListenRequestPacket,
    JoinRequestPacket
);
