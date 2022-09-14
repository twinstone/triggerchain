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

    export function fromSettled<T>(value: SettledValue<T>): FutureResource<T> {
        let canceled = false;
        return {
            isCanceled() {
                return canceled;
            },
            cancel() {
                canceled = true;
            },
            current() {
                return value;
            },
        };
    }

    export function fromPending<T>(value: PendingValue<T>): FutureResource<T> {
        const prom = value.promise
            .then((res) => {fv = FutureValue.fromValue(res); return res;})
            .catch((err) => {fv = FutureValue.fromError(err); throw err;});
        let fv: FutureValue<T> = FutureValue.fromPromise(prom);
        return {
            isCanceled() {
                return isPromiseCanceled(value.promise);
            },
            cancel() {
                cancelPromise(value.promise);
            },
            current() {
                return fv;
            },
        };
    }

}