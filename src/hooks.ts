import { DependencyList, useContext, useEffect, useState } from "react";
import { CallbackAccess } from "./access";
import { DataStoreContext } from "./DataStoreContext";
import { FutureResource } from "./FutureResource";
import { FutureMaterial, FutureValue, MaybeFutureMaterial, MaybeFutureValue } from "./FutureValue";
import { fail, isFunction } from "./utils";
import { StateAccess } from "./StateAccess";
import { ReadableState, SettableState } from "./state";

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

export function useDataCallback<A extends any[], R>(f: (access: CallbackAccess, ...args: A) => R, deps?: DependencyList): (...args: A) => R {
    const store =  useDataStore();
    return (...args) => {
        try {
            return StateAccess.withAccess(store, (access) => f(access.toCallbackAccess(), ...args));
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
export function useFutureValue<T, D>(value: MaybeFutureValue<T>, init: D | (() => D)): [current: MaybeFutureValue<T>, last: T | D];
export function useFutureValue<T>(value: MaybeFutureValue<T>): [current: MaybeFutureValue<T>, last: T | undefined];
export function useFutureValue<T, D>(value: MaybeFutureValue<T>, init?: D): [current: MaybeFutureValue<T>, last: T | D | undefined] {
    const [last, setLast] = useState<{last: T | D | undefined}>(() => ({last: isFunction(init) ? init() : init}));
    useEffect(() => {
        let canceled = false;
        if (value.state === "present" && !Object.is(last.last, value.value)) setLast({last: value.value});
        if (value.state !== "pending") return;
        value.promise.then(
            (val) => {if (!canceled) setLast({last: val})},
            () => {if (!canceled) setLast({last: last.last})},
        );
        return () => {
            canceled = true;
        };
    }, [value]);
    return [value, last.last];
}

export function useFutureResource<T, D>(init: D | (() => D), start: () => FutureMaterial<T>): [current: FutureValue<T>, last: T | D, setter: (mat: FutureMaterial<T>) => void];
export function useFutureResource<T, D>(init: D | (() => D)): [current: MaybeFutureValue<T>, last: T | D, setter: (mat: FutureMaterial<T>) => void];
export function useFutureResource<T>(): [current: MaybeFutureValue<T>, last: T | undefined, setter: (mat: FutureMaterial<T>) => void];
/**
 * Use idiomatic `current.settledOr(last).toValue()` to retrieve value that current component should use for rendering or throw error.
 * @param init initial value set to 'last' component before first future value settles. Undefined when omitted.
 * @param start function that returns initial future value - use to start async computation when components renders for first time
 * @returns triple [current, last, setter] where:
 *    current - current future value on NoValue if no computation was started. Use current.state to monitor progress of computation
 *    last - last settled value seen or initial value
 *    setter - function to call when new computation should start. If current value is settled, its value become 'last' element
 */
export function useFutureResource<T, D>(init?: D | (() => D), start?: () => FutureMaterial<T>): [current: MaybeFutureValue<T>, last: T | D | undefined, setter: (mat: FutureMaterial<T>) => void] {

    function wrap(mat: FutureMaterial<T>): FutureResource<T> {
        const fv = FutureValue.wrap(mat);
        return FutureResource.wrap(fv);
    }

    const [res, setRes] = useState<FutureResource<T> | undefined>(() => start && wrap(start()));

    useEffect(() => {
        if (res) return () => res.cancel();
    }, [res]);
 
    const [fv, last] = useFutureValue(res ? res.current() : FutureValue.noValue, init);

    return [fv, last, mat => setRes(wrap(mat))];
}