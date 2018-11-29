'use strict';
import { parseIP } from '../helpers';
import { Int } from '../../../protocol/bitcoin';

const mainOrder = ['addresses'];

const subTemplateOrder = ['time', 'services', 'ips', 'port'];
const subTemplate = {
    time: Int.parseUint32,
    services: Int.parseUint64,
    ips: parseIP,
    port: Int.parseUint16,
};

export function parse(Parser: DIParser, data: Buffer) {
    const { value: count, offset } = Int.parseVarSizeInt(data);

    const template = {
        addresses: Array.from({ length: count }, () => ({
            order: subTemplateOrder,
            template: subTemplate,
        }))
    };

    const parser = new Parser(mainOrder);
    const { addresses } = parser.parse(template, data.slice(Math.floor(offset / 8)));
    return (<ParseOutput[]>addresses).map((address) => Object.assign(address, {
        time: new Date(<number>address.time)
    }))
}