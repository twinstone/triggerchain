import { CancelError } from "./CancelError";
import { fail } from "./utils";

//See https://gist.github.com/pygy/6290f78b078e22418821b07d8d63f111

const cancelSymbol = Symbol("cancel");
const cancelStateSymbol = Symbol("cancelState");

export interface CancelablePromise<T> extends Promise<T> {
    [cancelSymbol]: () => void;
    [cancelStateSymbol]: () => boolean;
}

export function makeCancelable<T>(promise: Promise<T>, cancel: () => void, state: () => boolean): CancelablePromise<T>;
export function makeCancelable<T>(promise: Promise<T>, cancel: AbortController): CancelablePromise<T>;
export function makeCancelable<T>(promise: Promise<T>, cancel: () => void): CancelablePromise<T>;
export function makeCancelable<T>(promise: Promise<T>): CancelablePromise<T>;
export function makeCancelable<T>(promise: Promise<T>, cancel?: AbortController | (() => void), state?: () => boolean): CancelablePromise<T> {
    if (isCancelablePromise(promise)) return promise;
    let c;
    let s;
    let canceled = false;
    if (!cancel) {
        c = () => {canceled = true;};
        s = () => canceled;
    } else if (cancel instanceof AbortController) {
        c = () => cancel.abort(new CancelError());
        s = () => cancel.signal.aborted;
    } else if (state) {
        c = cancel;
        s = state;
    } else {
        c = () => {canceled = true; cancel();};
        s = () => canceled;
    }
    return Object.assign(promise, {[cancelSymbol]: c, [cancelStateSymbol]: s});
}

export function isCancelablePromise(promise: Promise<any>): promise is CancelablePromise<any> {
    return promise instanceof Promise && cancelSymbol in promise && cancelStateSymbol in promise;
}

export function cancelPromise(promise: CancelablePromise<any>): void {
    if (!(cancelSymbol in promise)) throw new Error("Not a cancelable promise");
    if (!isPromiseCanceled(promise)) {
        promise[cancelSymbol]();
    }
}

export function isPromiseCanceled(promise: CancelablePromise<any>): boolean {
    if (!(cancelStateSymbol in promise)) throw new Error("Not a cancelable promise");
    return promise[cancelStateSymbol]();
}

export function safeCancelable<T>(promise: Promise<T>): CancelablePromise<T> {
    const cp = makeCancelable(promise);
    let cancel: undefined | (() => void) = undefined;
    let canceled = false;
    const canceler = new Promise<T>((res, rej) => {
        cancel = () => {
            if (!canceled) {
                canceled = true;
                cancelPromise(cp);
                rej(new CancelError());
            }
        }
    });
    const race = Promise.race([cp, canceler]);
    return makeCancelable(race, cancel ?? fail("SHN"), () => canceled);
}