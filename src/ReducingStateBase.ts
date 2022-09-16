import { ReduceAccess } from "./access";
import { DataStore } from "./DataStore";
import { FutureMaterial, FutureValue, MaybeFutureMaterial } from "./FutureValue";
import { FutureResource } from "./FutureResource";
import { SerializationCfg } from "./SerializationCfg";
import { SettableState } from "./SettableState";
import { StateBase } from "./StateBase";
import { InitializeStateCfg } from "./configurations";

export abstract class ReducingStateBase<T, C> extends StateBase<T> {
    public constructor (key: string, hmrToken: object) {
        super(key, hmrToken);
    }

    public set(data: DataStore, v: MaybeFutureMaterial<T>): void {
        data.assertWrite(this);
        const store = data.find<T>(this.key, true);
        const value = FutureValue.wrapMaybe(v);
        store.set(value);
        data.note(this); //Noting has meaning only during SSR, and only time the state can be set is during initialization
    }
}