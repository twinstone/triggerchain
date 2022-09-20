import { BasicStateCfg, InitializeStateCfg } from "../configurations";
import { DataStore } from "../DataStore";
import { MaybeFutureMaterial } from "../FutureValue";
import { SettableState, stateTag } from "../state";
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
        const store = data.find<T>(this.key, true);
        this.setInternal(data, store, v);
        data.note(this); //Noting has meaning only during SSR, and only time the state can be set is during initialization
    }
}
