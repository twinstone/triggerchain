import { DependencyList, useContext, useEffect, useState } from "react";
import { CallbackAccess } from "./access";
import { DataStoreContext } from "./DataStoreContext";
import { FutureResource } from "./FutureResource";
import { FutureMaterial, FutureValue, MaybeFutureMaterial, MaybeFutureValue } from "./FutureValue";
import { fail, isFunction } from "./utils";
import { StateAccess } from "./StateAccess";
import { InitializableState, ReadableState, ReducingState, SettableState } from "./state";

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
    const store = useDataStore();
    const [fv, setFv] = useState(() => state.get(store));
    useEffect(() => {
        function callback() {
            const fv = state.get(store);
            setFv(fv);
        }
        const cancel = state.subscribe(store, callback);
        return cancel;
    }, [state.key, store]);
    console.log(`Getting ${state.key}: `, fv.current().state);
    return fv.current();
}

export function useDataSetter<T>(state: SettableState<T>): (value: MaybeFutureMaterial<T>) => void {
    const store =  useDataStore();
    const ret = (value: MaybeFutureMaterial<T>) => {
        state.set(store, value);
    }
    return ret;
}

/**
 * Sets value of a state, checking if its happens only one time in SSR mode. This hooks is intended for
 * scenarios when particular state can not be initialized globally (i.e. its value is derived from component property).
 * Is SSR mode, the hooks checks that state value was not set yet, othewise it throws exception. In client mode
 * the hook works same way as calling function created by `useDataSetter`, but it can not reset the state by setting state to FutureValue.NoValue.
 * To prevent errors in SSR, this hook must be used before any attempt to read value of the state.
 * Value set by this hook takes precence over state initializer (if exists).
 * @param state state being changed
 * @param value value that should be set to the state
 * @param cmp comparator of actual value and target value. Both current and provided value must be settled, otherwise comparison is skipped.
 * @returns function that initializes / changes the state in actual data store context
 */
export function useDataInit<T>(state: InitializableState<T>, value: FutureMaterial<T>, cmp?: (t1: T, t2: T) => boolean): void {
    const store =  useDataStore();
    if (cmp) {
        const res = store.find(state.key);
        if (res) {
            const fv1 = res.get().current();
            const fv2 = FutureValue.wrap(value);
            if (fv1.state === "present" && fv2.state === "present" && cmp(fv1.value as T, fv2.value)) return;
        }
    }
    state.init(store, value);
}

export function useDataReducer<C>(state: ReducingState<any, C>): (command: C) => void {
    const store =  useDataStore();
    const ret = (command: C) => {
        state.reduce(store, command);
    }
    return ret;
}

export function useDataReducingState<T, C>(state: ReducingState<T, C>): [value: T, setted: (value: MaybeFutureMaterial<T>) => void, reduce: (command: C) => void] {
    const value = useDataValue(state);
    const setter = useDataSetter(state);
    const reducer = useDataReducer(state);
    return [value, setter, reducer];
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
 * Use idiomatic `current.valueOr(last)` to retrieve value that current component should use for rendering or throw error.
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
 
    const [fv, last] = useFutureValue(res ? res.current() : FutureValue.noValue(), init);

    return [fv, last, mat => setRes(wrap(mat))];
}