import { createHash } from 'crypto';

export const dSha256 = (data: string | Buffer | NodeJS.TypedArray | DataView): Buffer => {
    return createHash('sha256').update(createHash('sha256').update(data).digest()).digest();
};

export const messageChecksum = (message: Buffer): Buffer => {
    return Buffer.from(dSha256(message)).slice(0, 4);
};

export const throttle = (func: Function, ms: number) => {

    let isThrottled = false;
    let savedArgs: IArguments;
    let savedThis: any;

    function wrapper() {

        if (isThrottled) {
            savedArgs = arguments;
            savedThis = this;
            return;
        }

        func.apply(this, arguments);

        isThrottled = true;

        setTimeout(function () {
            isThrottled = false;
            if (savedArgs) {
                wrapper.apply(savedThis, savedArgs);
                savedArgs = savedThis = null;
            }
        }, ms);
    }

    return wrapper;
}

export const getNonce = (): number => {
    let num;
    while (!num) {
        num = Math.random() * Math.pow(2, 32) - 1;
    }
    return Math.floor(num);
};

export const hexToString = (hexString: string): string => {
    let str = '';
    for (let i = 0; i < hexString.length; i += 2) {
        const firstNumber = hexString[i];
        const secondNumber = hexString[i + 1];
        if (firstNumber != '0' || secondNumber != '0') {
            str += String.fromCharCode(parseInt(firstNumber + secondNumber, 16));
        }
    }
    return str;
};