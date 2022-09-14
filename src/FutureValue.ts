import { CancelablePromise, cancelPromise, makeCancelable } from "./promiseTools";

const futureValueTag = Symbol();

export interface MaybeFutureValueBase<T> {
    readonly [futureValueTag]: true;
    readonly state: string;
    readonly isSettled: boolean;
    map<R>(f: (v: T) => FutureMaterial<R>): MaybeFutureValue<R>
    toPromise(): CancelablePromise<T>;
    toValue(): T;
    valueOr<R>(def: R): T | R;
    settled(): SettledValue<T>;
    settledOr(other: T | SettledValue<T>): SettledValue<T>;
    or(other: FutureMaterial<T>): FutureValue<T>;
}

interface FutureValueBase<T> extends MaybeFutureValueBase<T> {
    map<R>(f: (v: T) => FutureMaterial<R>): FutureValue<R>
}

export interface PendingValue<T> extends FutureValueBase<T> {
    readonly state: "pending";
    readonly isSettled: false;
    readonly promise: CancelablePromise<T>;
}

export interface PresentValue<T> extends FutureValueBase<T> {
    readonly state: "present";
    value: T;
    readonly isSettled: true;
}

export interface ErrorValue extends FutureValueBase<never> {
    state: "error";
    error: unknown;
    readonly isSettled: true;
}

export type SettledValue<T> = 
| PresentValue<T>
| ErrorValue;
;

export type FutureValue<T> = 
| PendingValue<T>
| SettledValue<T>
;



export interface NoValue extends MaybeFutureValueBase<never> {
    readonly state: "nothing";
    readonly isSettled: false;
}

export type MaybeSettledValue<T> = NoValue | SettledValue<T>;

export type MaybeFutureValue<T> = NoValue | FutureValue<T>;

//TODO consider removing Promise<T> in favor if cancelable ones.

export type FutureMaterial<T> = T | Promise<T> | CancelablePromise<T> | FutureValue<T>;

export type MaybeFutureMaterial<T> = T | Promise<T> | CancelablePromise<T> | MaybeFutureValue<T>;

export namespace FutureValue {

    export const noValue: NoValue = {
        state: "nothing",
        [futureValueTag]: true,
        isSettled: false,
        map: <R>(f: (v: never) => FutureMaterial<R>) => noValue,
        toPromise: () => { throw new Error("No Value") },
        toValue: () => { throw new Error("No Value") },
        valueOr: <R>(def: R) => def,
        settled: () => { throw new Error("No Value") },
        settledOr: (other: SettledValue<never>) => other,
        or: (other: FutureMaterial<never>) => wrap(other)
    };

    export function hasNoValue(v: unknown): v is NoValue {
        return isMaybe(v) && v.state === "nothing";
    }

    export function wrap<T>(mat: FutureMaterial<T>): FutureValue<T> {
        const ret = wrapMaybe<T>(mat);
        if (hasNoValue(ret)) throw new Error("NoValue is not allowed here");
        return ret;
    }

    export function wrapMaybe<T>(mat: MaybeFutureMaterial<T>): MaybeFutureValue<T> {
        if (isMaybe(mat)) return mat;
        if (mat instanceof Promise) return fromPromise<T>(mat);
        return fromValue<T>(mat);
    }

    export function isMaybe(v: unknown): v is MaybeFutureValue<any> {
        return typeof futureValueTag === "object" && !!v && (futureValueTag in v) && v[futureValueTag];
    }

    export function is(v: unknown): v is FutureValue<any> {
        return isMaybe(v) && v.state !== "nothing";
    }

    export function isSettled(v: unknown): v is SettledValue<any> {
        return isMaybe(v) && v.isSettled;
    }

    export function fromValue<T>(value: T): PresentValue<T> {
        const prom = makeCancelable(Promise.resolve(value));
        const ret: PresentValue<T> = {
            [futureValueTag]: true,
            state: "present",
            value: value,
            isSettled: true,
            toPromise: () => prom,
            toValue: () => value,
            settled: () => ret,
            settledOr: (other: T | SettledValue<T>) => ret,
            or: (other: FutureMaterial<T>) => ret,
            valueOr: <R>(other: R) => value,
            map: function<R>(f: (v: T) => FutureMaterial<R>) {
                try {
                    return wrap<R>(f(value));
                } catch (err) {
                    return fromError<R>(err);
                }
            },

        };
        return ret;
    }
    
    export function fromPromise<T>(value: Promise<T> | CancelablePromise<T>): PendingValue<T> {
        const promise = makeCancelable(value);
        const ret: PendingValue<T> = {
           [futureValueTag]: true,
           state: "pending",
           promise,
           isSettled: false,
           toPromise: () => promise,
           toValue: () => { throw new Error("Pending value") },
           map: <R>(f: (v: T) => FutureMaterial<R>) => {
            const abort = new AbortController();
            abort.signal.addEventListener("abort", () => cancelPromise(promise));
            const res = value.then(v => {
                const fv = wrap<R>(f(v));
                const fvc = makeCancelable(fv.toPromise());
                abort.signal.addEventListener("abort", () => cancelPromise(fvc));
                return fvc;
            });
            return fromPromise<R>(makeCancelable(res, abort));
           },
           settled: () => {throw new Error("Pending value")},
           settledOr: (other: T | SettledValue<T>) => isSettled(other) ? other : fromValue<T>(other),
           or: (other: FutureMaterial<T>) => ret,
           valueOr: <R>(other: R) => other,
       };
       return ret;
    }
    
    export function fromError<T>(value: unknown): ErrorValue {
        const prom = makeCancelable(Promise.reject(value));
        const ret: ErrorValue = {
           [futureValueTag]: true,
           state: "error",
           error: value,
           toPromise: () => prom,
           toValue: () => { throw value },
           isSettled: true,
           map: <R>(f: (v: never) => FutureMaterial<R>) => ret,
           settled: () => ret,
           settledOr: (other: T | SettledValue<T>) => ret,
           or: (other: FutureMaterial<T>) => ret,
           valueOr: <R>(other: R) => other,
        };
        return ret;
    }

    export function tryValue<T>(block: () => T): SettledValue<T> {
        try {
            return fromValue(block());
        } catch (err) {
            return fromError(err);
        }
    }
    
    /**
     * Unwraps future value to either value, thrown error or thrown promise. It is not
     * always safe to unwrap future value this way. Call this method only if you are sure
     * what are you doing. It is generally better idea to use `unwrap` method in state
     * callbacks access object as they are available in situations where unwrapping is
     * possible.
     * @param value future value to unwrap
     * @returns unwrapped value if present
     * @throws error if present or wrapped promise if pending
     */
    export function dangerouslyUnwrap<T>(value: MaybeFutureValue<T>): T {
        switch (value.state) {
            case "nothing":
                throw new Error("No value");
            case "pending":
                throw value.promise;
            case "present":
                return value.value;
            case "error":
                throw value.error;
        }
    }

    export function all<T extends readonly FutureValue<any>[] | []>(values: T): FutureValue<{ -readonly [P in keyof T]: T[P] extends FutureValue<infer F> ? F : never }> {
        const ret = [];
        outer: for (const value of values) {
            switch (value.state) {
                case "present":
                    ret.push(value.value);
                    break;
                case "error":
                    return value;
                case "pending":
                    break outer;
            }
        }
        if (ret.length === values.length) {
            return fromValue(ret as any);
        }
        const abort = new AbortController();
        const promise = Promise.all(values.map(v => {
            const p = v.toPromise();
            abort.signal.addEventListener("abort", () => cancelPromise(p));
            return p;
        }));
        return fromPromise(makeCancelable(promise, abort)) as any;
    }

    export function allSettled<T extends readonly FutureValue<any>[] | []>(values: T): FutureValue<{ -readonly [P in keyof T]: T[P] extends FutureValue<infer F> ? SettledValue<F> : never }> {
        const ret = [];
        outer: for (const value of values) {
            switch (value.state) {
                case "error":
                case "present":
                    ret.push(value);
                    break;
                case "pending":
                    break outer;
            }
        }
        if (ret.length === values.length) {
            return fromValue(ret as any);
        }
        const abort = new AbortController();
        const promise = Promise.allSettled(values.map(v => {
            const p = v.toPromise();
            abort.signal.addEventListener("abort", () => cancelPromise(p));
            return p;
        }));
        const res = promise.then(res => res.map(r => r.status === "fulfilled" ? fromValue(r.value) : fromError(r.reason)));
        return fromPromise(makeCancelable(res, abort)) as any;
    }

}

