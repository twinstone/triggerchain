import { BasicReducingState } from "./BasicReducingState";
import { BasicState } from "./BasicState";
import { BasicStateCfg, DerivedReducingStateCfg, DerivedStateCfg, ReducingStateCfg, UpdatableDerivedStateCfg } from "./configurations";
import { DerivedReducingState } from "./DerivedReducingState";
import { DerivedState, } from "./DerivedState";
import { Qualifier } from "./Qualifier";
import { ReadableState } from "./ReadableState";
import { ReducingState } from "./ReducingState";
import { SettableState } from "./SettableState";
import { UpdatableDerivedState } from "./UpdatableDerivedState";

const names = new Set<string>();

function checkKey(key: string) {
    if (names.has(key)) {
        console.error("State key '" + key + "' is already used. Ignore this error if HMR is in progress.");
    }
    names.add(key);
}

export function basicStateGroup<T, Q extends Qualifier>(key: string, cfg: (q: Q) => BasicStateCfg<T>): (q: Q) => SettableState<T> {
    checkKey(key);
    return q => {
        const qcfg = cfg(q);
        const qkey = key + "/" + Qualifier.toString(q);
        return new BasicState(qkey, cfg, qcfg);
    };
}

export function basicState<T>(key: string, cfg: BasicStateCfg<T>): SettableState<T> {
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

export function derivedReducingStateGroup<T, C, Q extends Qualifier>(key: string, cfg: (q: Q) => DerivedReducingStateCfg<T, C>): (q: Q) => DerivedReducingState<T, C> {
    checkKey(key);
    return q => {
        const qcfg = cfg(q);
        const qkey = key + "/" + Qualifier.toString(q);
        return new DerivedReducingState(qkey, cfg, qcfg);
    };
}

export function derivedReducingState<T, C>(key: string, cfg: DerivedReducingStateCfg<T, C>): DerivedReducingState<T, C> {
    checkKey(key);
    return new DerivedReducingState(key, cfg, cfg);
}
