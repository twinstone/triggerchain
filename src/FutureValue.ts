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
    settledOr<R>(other: R | SettledValue<R>): SettledValue<T | R>;
    or<R>(other: FutureMaterial<R>): FutureValue<T | R>;
    then<R>(f: (settled: SettledValue<T>) => FutureMaterial<R>): MaybeFutureValue<R>;
}

interface FutureValueBase<T> extends MaybeFutureValueBase<T> {
    map<R>(f: (v: T) => FutureMaterial<R>): FutureValue<R>
    then<R>(f: (settled: SettledValue<T>) => FutureMaterial<R>): FutureValue<R>;
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
        settledOr: <R>(other: R | SettledValue<R>) => isSettled(other) ? other : fromValue<R>(other),
        or: <R>(other: FutureMaterial<R>) => wrap(other),
        then: <R>(f: (settled: SettledValue<never>) => FutureMaterial<R>) => noValue,
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
        if (typeof v === "object" && !!v) {
            const o: object = v;
            return (futureValueTag in o) && (o as any)[futureValueTag];
        }
        return false;
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
            settledOr: <R>(other: R | SettledValue<R>) => ret,
            or: <R>(other: FutureMaterial<R>) => ret,
            valueOr: <R>(other: R) => value,
            //Need to use 'as' because of overloaded method defintion. 
            map: <R>(f: (v: T) => FutureMaterial<R>) => tryFutureValue(() => f(value)),
            then: <R>(f: (settled: SettledValue<T>) => FutureMaterial<R>) => tryFutureValue(() => f(ret)), 
        };
        const z = ret.map(() => tryFutureValue(() => 7));
        return ret;
    }
    
    export function fromPromise<T>(value: Promise<T> | CancelablePromise<T>): PendingValue<T> {
        const promise = makeCancelable(value);
        
        function thenFn<R>(f: (v: SettledValue<T>) => FutureMaterial<R>): FutureValue<R> {
            const abort = new AbortController();
            abort.signal.addEventListener("abort", () => cancelPromise(promise));
            const res = value.then(
                v => {
                    const fv = wrap<R>(f(fromValue(v)));
                    const fvc = makeCancelable(fv.toPromise());
                    abort.signal.addEventListener("abort", () => cancelPromise(fvc));
                    return fvc;
                },
                err => {
                    const fv = wrap<R>(f(fromError(err)));
                    const fvc = makeCancelable(fv.toPromise());
                    abort.signal.addEventListener("abort", () => cancelPromise(fvc));
                    return fvc;
                }
            );
            return fromPromise<R>(makeCancelable(res, abort));
        }

        function mapFn<R>(f: (v: T) => FutureMaterial<R>): FutureValue<R> {
            return thenFn(fv => {
                if (fv.state === "error") return fv;
                return f(fv.value);
            });
        }

        const ret: PendingValue<T> = {
           [futureValueTag]: true,
           state: "pending",
           promise,
           isSettled: false,
           toPromise: () => promise,
           toValue: () => { throw new Error("Pending value") },
           then: thenFn,
           map: mapFn,
           settled: () => {throw new Error("Pending value")},
           settledOr: <R>(other: R | SettledValue<R>) => isSettled(other) ? other : fromValue<R>(other),
           or: <R>(other: FutureMaterial<R>) => ret,
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
           settledOr: <R>(other: R | SettledValue<R>) => ret,
           or: <R>(other: FutureMaterial<R>) => ret,
           valueOr: <R>(other: R) => other,
            //Need to use 'as' because of overloaded method defintion. 
           then: <R>(f: (settled: SettledValue<never>) => FutureMaterial<R>) => tryFutureValue(() => f(ret)), 
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

    export function tryFutureValue<T>(block: () => FutureMaterial<T>): FutureValue<T> {
        const ret = tryMaybeFutureValue(block);
        if (hasNoValue(ret)) throw new Error("SHN");
        return ret;
    }
    
    export function tryMaybeFutureValue<T>(block: () => MaybeFutureMaterial<T>): MaybeFutureValue<T>{
        try {
            const mat = block();
            return wrapMaybe(mat);
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

