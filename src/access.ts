import { DependencyList } from "react";
import { FutureMaterial, FutureValue, MaybeFutureMaterial, MaybeFutureValue } from "./FutureValue";
import { ReadableState } from "./ReadableState";
import { ReducingState } from "./ReducingState";
import { SettableState } from "./SettableState";

export interface ReduceAccess {
    value: <T>(state: ReadableState<T>) => FutureValue<T>;
    /**
     * Each time the method is invoked, it must be provided with future value originating from
     * outer context. Starting a computation each time the unwrap is called will result in
     * infinite loop.
     * @param source 
     */
    unwrap: <T>(value: MaybeFutureValue<T>) => T;
    /**
     * Similarily to React hooks, the method call must occur in same order and same count
     * for each invocation of reduce/derive methods. I.e. do not call in conditional blocks.
     */
    use: <T>(init: () => FutureMaterial<T>, deps: DependencyList) => FutureValue<T>;
}

export interface ReadAccess extends ReduceAccess {
    get: <T>(store: ReadableState<T>) => T;
    getMany: <A extends readonly ReadableState<any>[] | []>(args: A) => { -readonly [P in keyof A]: A[P] extends ReadableState<infer T> ? T : never };
    getValue: <T>(store: ReadableState<T>) => FutureValue<T>;
}

export interface DerivedReduceAccess extends ReadAccess {
}

export interface InitAccess {
    set: <T>(state: SettableState<T>, value: MaybeFutureMaterial<T>) => void;
}

export interface WriteAccess extends InitAccess {
    refresh: (state: ReadableState<any>) => void;
    reduce: <T, C>(state: ReducingState<T, C>, command: C) => void;
}

export interface CallbackAccess extends WriteAccess {
    value: <T>(state: ReadableState<T>) => FutureValue<T>;
}

