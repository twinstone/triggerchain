import { DependencyList, useContext, useEffect, useState } from "react";
import { CallbackAccess } from "./access";
import { DataStoreContext } from "./DataStoreContext";
import { FutureValue, MaybeFutureMaterial } from "./FutureValue";
import { ReadableState } from "./ReadableState";
import { SettableState } from "./SettableState";
import { fail } from "./utils";

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
            const access: CallbackAccess = {
                value: <T>(state: ReadableState<T>) => fail("Unimplemented"),
                set: <T>(state: SettableState<T>, value: MaybeFutureMaterial<T>) => fail("Unimplemented"),
                refresh: (state: ReadableState<any>) => fail("Unimplemented"),
            };
            f(access, ...args);
            //notify subscribers
        } catch (e) {
            if (e instanceof Promise) throw new Error("Promise signalling is not allowed in callback");
            throw e;
        }
    };
}
