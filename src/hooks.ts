import { DependencyList, useContext, useEffect, useState } from "react";
import { CallbackAccess } from "./access";
import { DataStoreContext } from "./DataStoreContext";
import { FutureResource } from "./FutureResource";
import { FutureMaterial, FutureValue, MaybeFutureMaterial, MaybeFutureValue } from "./FutureValue";
import { ReadableState } from "./ReadableState";
import { SettableState } from "./SettableState";
import { fail } from "./utils";
import { ValueAccess } from "./ValueAccess";

//TODO: useSyncExternalStore

export function useDataStore() {
    return useContext(DataStoreContext) || fail("DataStoreContext not found, must be used insite InitDataStore component")
}

export function useDataState<T>(state: SettableState<T>): [value: T, setter: (value: MaybeFutureMaterial<T>) => void]  {
    const value = useDataValue(state);
    const setter = useDataSetter(state);
    return [value, setter];
}

export function useDataValue<T>(state: ReadableState<T>): T {
    const fv = useDataFutureValue(state);
    return FutureValue.dangerouslyUnwrap(fv);
}

export function useDataFutureValue<T>(state: ReadableState<T>): FutureValue<T> {
    const store =  useDataStore();
    const [fv, setFv] = useState(() => state.get(store));
    useEffect(() => {
        function callback() {
            const fv = state.get(store);
            setFv(fv);
        }
        const cancel = state.subscribe(store, callback);
        return cancel;
    }, [state.key]);
    console.log(`Getting ${state.key}`, fv.current().state);
    return fv.current();
}

export function useDataSetter<T>(state: SettableState<T>): (value: MaybeFutureMaterial<T>) => void {
    const store =  useDataStore();
    const ret = (value: MaybeFutureMaterial<T>) => {
        state.set(store, value);
    }
    return ret;
}

export function useDataCallback<A extends any[]>(f: (access: CallbackAccess, ...args: A) => void, deps?: DependencyList): (...args: A) => void {
    const store =  useDataStore();
    return (...args) => {
        try {
            const access = new ValueAccess(store);
            store.startBatch();
            try {
                f(access.toCallbackAccess(), ...args);
            } finally {
                store.endBatch();
            }
        } catch (e) {
            if (e instanceof Promise) throw new Error("Promise signalling is not allowed in callback");
            throw e;
        }
    };
}

/**
 * Triggers component re-render when provided future is settled. It is expected that during re-rendering
 * source of the future value will return settled value.
 * @param value future value to be awaited.
 */
export function useFutureValue<T>(value: MaybeFutureValue<T>): void {
    const [, setObj] = useState({});
    useEffect(() => {
        let canceled = false;
        if (value.state !== "pending") return;
        const trigger = () => {if (!canceled) setObj({})}
        value.promise.then(trigger, trigger);
        return () => {
            canceled = true;
        };
    }, [value]);
}

export function useFutureResource<T>(): [current: MaybeFutureValue<T>, last: T | undefined, setter: (mat: FutureMaterial<T>) => void];
export function useFutureResource<T, D=T>(init: D): [current: MaybeFutureValue<T>, last: T | D, setter: (mat: FutureMaterial<T>) => void];
export function useFutureResource<T, D=T>(init: D, start: () => FutureMaterial<T>): [current: FutureValue<T>, last: T | D, setter: (mat: FutureMaterial<T>) => void];
export function useFutureResource<T, D=undefined>(init?: D, start?: () => FutureMaterial<T>): [current: MaybeFutureValue<T>, last: T | D, setter: (mat: FutureMaterial<T>) => void] {

    function wrap(mat: FutureMaterial<T>): FutureResource<T> {
        const fv = FutureValue.wrap(mat);
        return FutureResource.wrap(fv);
    }

    function startFun() {
        if (!start) return undefined;
        return wrap(start());
    }

    const [res, setRes] = useState<FutureResource<T> | undefined>(startFun);
    const [last, setLast] = useState<T | D | undefined>(init);

    useEffect(() => {
        if (res) return () => res.cancel();
    }, [res]);
 
    useFutureValue(res ? res.current() : FutureValue.noValue);

    function setResource(mat: FutureMaterial<T>): void {
        const prev = res ? res.current() : FutureValue.noValue;
        if (prev.state === "present") setLast(prev.value);
        setRes(wrap(mat));
    }

    return [res ? res.current() : FutureValue.noValue, last!, setResource];
}