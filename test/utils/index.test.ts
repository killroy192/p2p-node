import { createHash } from 'crypto';
import { dSha256, messageChecksum, getNonce, hexToString, throttle } from '../../src/utils';
import { expect } from 'chai';
import { spy } from 'sinon';
import 'mocha';

describe('P2P:utils', () => {
    describe('dSha256', () => {
        it('should create double sha256 hash', () => {
            expect(dSha256('!@#$%^&*()_+abcDEF123').toString('hex')).to.equal('32a641962bfa63ad881166d63cebfcfade1a612eafedb70ed96364efee70bb75');
        });
    });
    describe('messageChecksum', () => {
        it('should return buffer of first fore bytes of double sha256 hash', () => {
            const buffer = Buffer.alloc(8);
            buffer.writeInt32LE(0xff, 0);
            const checkSum = createHash('sha256')
                .update(
                    createHash('sha256')
                    .update(buffer)
                    .digest()
                )
                .digest()
                .slice(0, 4)
                .toString('hex')
            expect(messageChecksum(buffer).toString('hex')).to.equal(checkSum);
        });
    }); 
    describe('throttle', () => {
        it('should throttle calling function', (done) => {
            const fn = spy();
            const intervalCall = 5;
            const debounceTime = 10;
            const totalTime = 100;
            const debouncedCallsCount = totalTime / debounceTime - 1
            const throttledFn = throttle(fn, debounceTime);
            const timer = global.setInterval(throttledFn, intervalCall);
            setTimeout(() => {
                clearInterval(timer);
                expect(fn.callCount).above(debouncedCallsCount);
                done();
            }, totalTime);
        });    
    });
    describe('getNonce', () => {
        it('should return number strong less then 2^32 and strong more than 0', () => {
            const max = Math.pow(2, 32);
            for (let index = 0; index < 10000; index++) {
                const nonce = getNonce();
                expect(nonce).lessThan(max).and.to.be.above(0)
            }
        });
    });
    describe('hexToString', () => {
        it('should hex string where every two char is code of ancii to utf-8 string', () => {
            const decoded = "This is my string to be encoded/decoded";
            const encoded = '54686973206973206d7920737472696e6720746f20626520656e636f6465642f6465636f646564';
            expect(hexToString(encoded)).to.be.equal(decoded);
        });
    });
});