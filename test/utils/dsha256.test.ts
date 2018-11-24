
import { dSha256 } from '../../src/utils';
import { expect } from 'chai';
import 'mocha';

describe('P2P:core dSha256', () => {
    it('should create double sha256 hash', () => {
        expect(dSha256('!@#$%^&*()_+abcDEF123').toString('hex')).to.equal('32a641962bfa63ad881166d63cebfcfade1a612eafedb70ed96364efee70bb75');
    });
});