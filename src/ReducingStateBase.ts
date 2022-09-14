import { ReduceAccess } from "./access";
import { DataStore } from "./DataStore";
import { FutureMaterial } from "./FutureValue";
import { FutureResource } from "./FutureResource";
import { SerializationCfg } from "./SerializationCfg";
import { SettableState } from "./SettableState";
import { StateBase } from "./StateBase";

export abstract class ReducingStateBase<T, C> extends StateBase<T> {
    public constructor (key: string, hmrToken: object) {
        super(key, hmrToken);
    }
    set(data: DataStore, v: FutureMaterial<T>): void {
        throw new Error("Method not implemented.");
    }
    public get(data: DataStore): FutureResource<T> {
        throw new Error("Method not implemented.");
    }
}