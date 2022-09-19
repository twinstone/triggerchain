import { BasicStateCfg, InitializeStateCfg } from "./configurations";
import { DataStore } from "./DataStore";
import { MaybeFutureMaterial } from "./FutureValue";
import { SettableState, stateTag } from "./state";
import { StateBase } from "./StateBase";

export class BasicState<T> extends StateBase<T> implements SettableState<T> {

    public readonly [stateTag] = "settable";
    
    public constructor(key: string, hmrToken: object, protected readonly cfg: BasicStateCfg<T>) {
        super(key, hmrToken);
    }

    protected initCfg(): InitializeStateCfg<T> {
        return this.cfg;
    }

    public set(data: DataStore, v: MaybeFutureMaterial<T>): void {
        data.assertWrite(this);
        this.setInternal(data, v);
    }
}
