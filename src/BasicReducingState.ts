import { ReduceAccess } from "./access";
import { DataStore } from "./DataStore";
import { FutureMaterial } from "./FutureValue";
import { FutureResource } from "./FutureResource";
import { ReducingState } from "./ReducingState";
import { SerializationCfg } from "./SerializationCfg";
import { SettableState } from "./SettableState";
import { StateBase } from "./StateBase";
import { ReducingStateBase } from "./ReducingStateBase";

export interface ReducingStateCfg<T, C> {
    readonly init?: FutureMaterial<T> | (() => FutureMaterial<T>);
    readonly pickler?: SerializationCfg<T>;
    readonly reduce: (access: ReduceAccess, previous: T, command: C) => FutureMaterial<T>;
}

export class BasicReducingState<T, C> extends ReducingStateBase<T, C> implements ReducingState<T, C> {

    public constructor (key: string, hmrToken: object, protected readonly cfg: ReducingStateCfg<T, C>) {
        super(key, hmrToken);
    }

    reduce(command: C): void {
        throw new Error("Method not implemented.");
    }

    set(data: DataStore, v: FutureMaterial<T>): void {
        throw new Error("Method not implemented.");
    }

    public get(data: DataStore): FutureResource<T> {
        throw new Error("Method not implemented.");
    }
    public pickler(): SerializationCfg<T> | undefined {
        return this.cfg.pickler;
    }
}