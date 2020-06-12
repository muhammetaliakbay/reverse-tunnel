const ipRule = /^(0|[1-9][0-9]{0,2})\.(0|[1-9][0-9]{0,2})\.(0|[1-9][0-9]{0,2})\.(0|[1-9][0-9]{0,2})$/;
const domainRule = /^([a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,})|localhost$/;
const portRule = /^[1-9][0-9]{0,4}$/;
const addressRule = /^([^:]+)(:([^:]+))?$/;

export type IPAddress = [number, number, number, number];
export type Domain = [string, string, ... string[]];
export type ParsedHost = {
    text: string
    ip: IPAddress
} | {
    text: string
    domain: Domain
};
export interface ParsedAddress {
    host: ParsedHost,
    port?: number
}

export function parsePort(port: string | number): false | number {
    let number: number;
    if (typeof port === 'string') {
        if (portRule.test(port)) {
            number = Number(port);
        } else {
            return false;
        }
    } else if(typeof port === 'number') {
        number = port;
    } else {
        return false;
    }

    if (number > 0 && number <= 0xFFFF) {
        return number;
    } else {
        return false;
    }
}

export function parseIPAddress(ip: string): false | IPAddress {
    const match = ip.match(ipRule);
    if (match == null) {
        return false;
    } else {
        const numbers = [1, 2, 3, 4].map(
            group => Number(match[group])
        ) as IPAddress;

        if (numbers.find(number => number < 0 && number > 255) != null) {
            return false;
        }
        else {
            return numbers;
        }
    }
}

export function parseDomain(domain: string): false | Domain {
    if (domainRule.test(domain)) {
        return domain.split('.') as Domain;
    } else {
        return false;
    }
}

export function parseHost(host: string): false | ParsedHost {
    let ip: false | IPAddress = false, domain: false | Domain = false;

    const address = (ip = parseIPAddress(host)) || (domain = parseDomain(host));
    if (address === false) {
        return false;
    }

    const result = {
        text: host,
    } as ParsedHost;

    if (ip !== false) {
        (result as any).ip = ip;
    } else if (domain !== false) {
        (result as any).domain = domain;
    }

    return result;
}

export function parseAddress(address: string): false | ParsedAddress {
    const match = address.match(addressRule);
    if (match == null) {
        return false;
    } else {
        const hostText = match[1];
        const portText = match[3] || null;

        let ip: false | IPAddress = false, domain: false | Domain = false;

        const address = (ip = parseIPAddress(hostText)) || (domain = parseDomain(hostText));
        if (address === false) {
            return false;
        }

        const port = portText == null ? null : parsePort(portText);
        if (port === false) {
            return false;
        }

        const result = {
            host: {
                text: hostText,
            },
        } as ParsedAddress;

        if (ip !== false) {
            (result.host as any).ip = ip;
        } else if (domain !== false) {
            (result.host as any).domain = domain;
        }

        if (port !== null) {
            result.port = port;
        }

        return result;
    }
}
