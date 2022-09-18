import { FutureMaterial, FutureValue, PendingValue, SettledValue } from "./FutureValue";
import { cancelPromise, isPromiseCanceled } from "./promiseTools";

export interface FutureResource<T> {
    current(): FutureValue<T>;
    isCanceled(): boolean;
    cancel(): void;
}

export namespace FutureResource {
    export function wrap<T>(value: FutureMaterial<T>): FutureResource<T> {
        const fv = FutureValue.wrap<T>(value);
        if (fv.isSettled) return fromSettled(fv);
        return fromPending(fv);
    }

    export function fromSettled<T>(value: T | SettledValue<T>): FutureResource<T> {
        const fv = FutureValue.is(value) ? value : FutureValue.fromValue(value);
        let canceled = false;
        return {
            isCanceled() {
                return canceled;
            },
            cancel() {
                canceled = true;
            },
            current() {
                return fv;
            },
        };
    }

    export function fromPending<T>(value: Promise<T> | PendingValue<T>): FutureResource<T> {
        const fv = value instanceof Promise? FutureValue.fromPromise<T>(value) : value;
        const prom = fv.promise
            .then((res) => {ret = FutureValue.fromValue(res); return res;})
            .catch((err) => {ret = FutureValue.fromError(err); throw err;});
        const ret0 = FutureValue.fromPromise(prom);
        let ret: FutureValue<T> = ret0;
        let canceled = false;
        return {
            isCanceled() {
                return canceled;
            },
            cancel() {
                canceled = true;
                if (ret === ret0) cancelPromise(fv.promise);
            },
            current() {
                return ret;
            },
        };
    }

}