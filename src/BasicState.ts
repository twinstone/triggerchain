import { BasicStateCfg, InitializeStateCfg } from "./configurations";
import { DataStore } from "./DataStore";
import { FutureResource } from "./FutureResource";
import { FutureValue, MaybeFutureMaterial } from "./FutureValue";
import { Qualifier } from "./Qualifier";
import { SerializationCfg } from "./SerializationCfg";
import { SettableState } from "./SettableState";
import { StateBase } from "./StateBase";

export class BasicState<T> extends StateBase<T> implements SettableState<T> {

    public constructor(key: string, hmrToken: object, protected readonly cfg: BasicStateCfg<T>) {
        super(key, hmrToken);
    }

    protected initCfg(): InitializeStateCfg<T> {
        return this.cfg;
    }

    public set(data: DataStore, v: MaybeFutureMaterial<T>): void {
        data.assertWrite(this);
        const store = data.find<T>(this.key, true);
        const value = FutureValue.wrapMaybe(v);
        store.set(value);
        data.note(this); //Noting has meaning only during SSR, and only time the state can be set is during initialization
    }
}
