import { expect } from 'chai';
import { spy } from 'sinon';
import 'mocha';

import * as net from 'net';
import { Peer } from '../../src';

describe('P2P:core Peer', () => {
    it('should properly connect to indicated host', (done) => {
        let localPeer: Peer;
        const server = net.createServer(() => {
            server.close();
            localPeer.destroy();
            done();
        });
        server.listen(() => {
            const { address, port } = server.address() as net.AddressInfo;
            localPeer = new Peer({ host: address, port }, 0x01020304);
            localPeer.connect();
        });
    });

    it('should send buffer data to connected socket', (done) => {
        let localPeer: Peer;

        const server = net.createServer(() => {
            localPeer.send(Buffer.alloc(8, 0), () => {
                server.close();
                localPeer.destroy();
                done();
            })
        });
        server.listen(() => {
            const { address, port } = server.address() as net.AddressInfo;
            localPeer = new Peer({ host: address, port }, 0x01020304);
            localPeer.connect();
        });
    });

    describe('events', () => {
        const magic = 0x01020304;
        let server: net.Server;
        let serverPeer: Peer;
        let message: Buffer;

        const makeMessage = () => {
            const message = Buffer.alloc(80, 0);
            message.writeUInt32LE(magic, 0);
            message.writeUInt32LE(magic, 64);
            return message;
        }

        beforeEach((done) => {
            message = makeMessage();
            serverPeer = null;
            server = net.createServer((socket: net.Socket) => {
                serverPeer = new Peer({ host: socket.remoteAddress, port: socket.remotePort }, magic);
                serverPeer.connect(socket);
            }).listen(() => done());
        });

        afterEach(() => {
            message = null;
            if (serverPeer) serverPeer.destroy();
            server.close();
        });

        describe('connect', () => {
            it('peer should emit \'connect\' event after successful connection', (done) => {
                const { address, port } = <net.AddressInfo>server.address()
                const peer = new Peer({ host: address, port }, magic);
                peer.on('connect', function () {
                    peer.destroy();
                    done();
                });
                peer.connect();
            });
        });

        describe('close', () => {
            it('peer should emit \'close\' event after successful disconnecting', (done) => {
                const { address, port } = <net.AddressInfo>server.address()
                const peer = new Peer({ host: address, port }, magic);
                peer.on('close', function () {
                    peer.destroy();
                    done();
                });
                peer.connect();
                peer.disconnect();
            });
        });

        describe('end', () => {
            it('peer should emit \'end\' event before closing socket', (done) => {
                const { address, port } = <net.AddressInfo>server.address()
                const peer = new Peer({ host: address, port }, magic);
                const callback = spy();
                peer.on('end', callback)
                peer.on('close', function () {
                    expect(callback.called).to.be.true;
                    peer.destroy();
                    done();
                });
                peer.connect();
                peer.disconnect();
            });
        });

        describe('error', () => {
            let localPeer: Peer;

            beforeEach((done) => {
                const { address, port } = <net.AddressInfo>server.address()
                localPeer = new Peer({ host: address, port }, magic);
                localPeer.on('connect', () => {
                    done();
                });
                localPeer.connect();
            });

            afterEach(() => {
                localPeer.destroy();
                localPeer = null;
            });

            it('peer should emit \'error\' event', (done) => {
                localPeer.on('error', function () {
                    localPeer.destroy();
                    done();
                });

                localPeer.emit('error');
            });
        });

        describe('message', () => {
            let localPeer: Peer;

            beforeEach((done) => {
                const { address, port } = <net.AddressInfo>server.address()
                localPeer = new Peer({ host: address, port }, magic);
                localPeer.on('connect', () => {
                    done();
                });
                localPeer.connect();
            });

            afterEach(() => {
                localPeer.destroy();
                localPeer = null;
            });

            it('should handle new income buffers via emitting \'message\' event', (done) => {
                localPeer.on('message', function (d) {
                    done();
                });

                serverPeer.send(message);
            });
            it('should emit \'message\' event with correct data object', (done) => {
                localPeer.on('message', function (d) {
                    expect(d.peer, 'peer property should be instance of Peer class').to.be.an.instanceof(Peer);
                    expect(d.data, 'data property equal sent data').exist;
                    done();
                });

                serverPeer.send(message);
            });
        });
    });
});