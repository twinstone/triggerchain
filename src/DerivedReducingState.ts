import { DerivedReduceAccess, ReduceAccess } from "./access";
import { DataStore } from "./DataStore";
import { FutureMaterial } from "./FutureValue";
import { FutureResource } from "./FutureResource";
import { ReducingState } from "./ReducingState";
import { ReducingStateBase } from "./ReducingStateBase";
import { SerializationCfg } from "./SerializationCfg";

export interface DerivedReducingStateCfg<T, C> {
    readonly init?: FutureMaterial<T> | (() => FutureMaterial<T>);
    readonly pickler?: SerializationCfg<T>;
    /**
     * Null reduction - called when dependencies change
     */
    readonly reduce: (access: DerivedReduceAccess, previous: T, command?: C) => FutureMaterial<T>;
}

export class DerivedReducingState<T, C> extends ReducingStateBase<T, C> implements ReducingState<T, C> {
    public constructor (key: string, hmrToken: object, protected readonly cfg: DerivedReducingStateCfg<T, C>) {
        super(key, hmrToken);
    }

    public pickler(): SerializationCfg<T> | undefined {
        return this.cfg.pickler;
    }

    reduce(command: C): void {
        throw new Error("Method not implemented.");
    }

    public get(data: DataStore): FutureResource<T> {
        throw new Error("Method not implemented.");
    }
    
}