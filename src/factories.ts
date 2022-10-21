import { BasicReducingState } from "./states/BasicReducingState";
import { BasicState } from "./states/BasicState";
import { BasicStateCfg, DerivedReducingStateCfg, DerivedStateCfg, ReducingStateCfg, UpdatableDerivedStateCfg } from "./configurations";
import { DerivedReducingState } from "./states/DerivedReducingState";
import { DerivedState } from "./states/DerivedState";
import { FutureMaterial, SettledValue } from "./FutureValue";
import { Qualifier } from "./Qualifier";
import { SelectorState } from "./states/SelectorState";
import { InitializableState, ReadableState, ReducingState, SettableState } from "./state";
import { UpdatableDerivedState } from "./states/UpdatableDerivedState";

const names = new Set<string>();

function checkKey(key: string) {
    if (names.has(key)) {
        console.error("State key '" + key + "' is already used. Ignore this error if HMR is in progress.");
    }
    names.add(key);
}

export function basicStateGroup<T, Q extends Qualifier>(key: string, cfg: (q: Q) => BasicStateCfg<T>): (q: Q) => InitializableState<T> {
    checkKey(key);
    return q => {
        const qcfg = cfg(q);
        const qkey = key + "/" + Qualifier.toString(q);
        return new BasicState(qkey, cfg, qcfg);
    };
}

export function basicState<T>(key: string, cfg: BasicStateCfg<T>): InitializableState<T> {
    checkKey(key);
    return new BasicState(key, cfg, cfg);
}

function isUpdatable<T>(cfg: DerivedStateCfg<T> | UpdatableDerivedStateCfg<T>): cfg is UpdatableDerivedStateCfg<T> {
    return "onSet" in cfg;
}

export function derivedState<T>(key: string, cfg: UpdatableDerivedStateCfg<T>): SettableState<T>;
export function derivedState<T>(key: string, cfg: DerivedStateCfg<T>): ReadableState<T>;
export function derivedState<T>(key: string, cfg: DerivedStateCfg<T> | UpdatableDerivedStateCfg<T>): ReadableState<T> {
    checkKey(key);
    if (isUpdatable(cfg)) {
        return new UpdatableDerivedState(key, cfg, cfg);
    } else {
        return new DerivedState(key, cfg, cfg);
    }
}

export function derivedStateGroup<T, Q extends Qualifier>(key: string, cfg: (q: Q) => UpdatableDerivedStateCfg<T>): (q: Q) => SettableState<T>;
export function derivedStateGroup<T, Q extends Qualifier>(key: string, cfg: (q: Q) => DerivedStateCfg<T>): (q: Q) => ReadableState<T>;
export function derivedStateGroup<T, Q extends Qualifier>(key: string, cfg: ((q: Q) => DerivedStateCfg<T>) | ((q: Q) => UpdatableDerivedStateCfg<T>)): (q: Q) => ReadableState<T> {
    checkKey(key);
    return q => {
        const qcfg = cfg(q);
        const qkey = key + "/" + Qualifier.toString(q);
        if (isUpdatable(qcfg)) {
            return new UpdatableDerivedState(qkey, cfg, qcfg);
        } else {
            return new DerivedState(qkey, cfg, qcfg);
        }    
    };
}

export function reducingStateGroup<T, C, Q extends Qualifier>(key: string, cfg: (q: Q) => ReducingStateCfg<T, C>): (q: Q) => ReducingState<T, C> {
    checkKey(key);
    return q => {
        const qcfg = cfg(q);
        const qkey = key + "/" + Qualifier.toString(q);
        return new BasicReducingState(qkey, cfg, qcfg);
    };
}

export function reducingState<T, C>(key: string, cfg: ReducingStateCfg<T, C>): ReducingState<T, C> {
    checkKey(key);
    return new BasicReducingState(key, cfg, cfg);
}

export function derivedReducingStateGroup<T, C, Q extends Qualifier>(key: string, cfg: (q: Q) => DerivedReducingStateCfg<T, C>): (q: Q) => ReducingState<T, C> {
    checkKey(key);
    return q => {
        const qcfg = cfg(q);
        const qkey = key + "/" + Qualifier.toString(q);
        return new DerivedReducingState(qkey, cfg, qcfg);
    };
}

export function derivedReducingState<T, C>(key: string, cfg: DerivedReducingStateCfg<T, C>): ReducingState<T, C> {
    checkKey(key);
    return new DerivedReducingState(key, cfg, cfg);
}

export function selectorState<T, R>(original: ReadableState<T>, map: (v: SettledValue<T>) => FutureMaterial<R>): ReadableState<R> {
    return new SelectorState<T, R>(original, map);
}
