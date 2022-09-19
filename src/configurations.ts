import { DerivedReduceAccess, ReadAccess, ReduceAccess, WriteAccess } from "./access";
import { StateEffect } from "./effect";
import { FutureMaterial, MaybeFutureMaterial, MaybeFutureValue, MaybeSettledValue, PendingValue } from "./FutureValue";
import { SerializationCfg } from "./SerializationCfg";
import { ReadableState } from "./state";

export interface StateCfgBase<T> {
    readonly comparator?: (v1: T, v2: T) => boolean;
    readonly effects?: Array<StateEffect<T>>;
    readonly swr?: boolean;
    readonly pickler?: SerializationCfg<T>;
}

export interface InitializeStateCfg<T> {
    readonly init?: MaybeFutureMaterial<T> | (() => MaybeFutureMaterial<T>) | ReadableState<T>;
}

export interface BasicStateCfg<T> extends StateCfgBase<T>, InitializeStateCfg<T> {
}

export interface DerivedStateCfg<T> extends StateCfgBase<T> {
    readonly derive: (access: ReadAccess) => FutureMaterial<T>;
}

export interface UpdatableDerivedStateCfg<T> extends DerivedStateCfg<T> {
    readonly onSet: (access: WriteAccess, value: MaybeSettledValue<T>) => void
    readonly onPending: (access: WriteAccess, value: PendingValue<T>) => void
}

export interface ReducingStateCfg<T, C> extends StateCfgBase<T>, InitializeStateCfg<T> {
    readonly reduce: (access: ReduceAccess, previous: T, command: C) => FutureMaterial<T>;
}

export interface DerivedReducingStateCfg<T, C> extends StateCfgBase<T>, InitializeStateCfg<T> {
    /**
     * Null reduction - called when dependencies change
     */
    readonly reduce: (access: DerivedReduceAccess, previous: T, command?: C) => FutureMaterial<T>;
}
