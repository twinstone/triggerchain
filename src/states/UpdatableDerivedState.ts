import { UpdatableDerivedStateCfg } from "../configurations";
import { DataStore } from "../DataStore";
import { DerivedStateBase } from "./DerivedStateBase";
import { FutureValue, MaybeFutureMaterial } from "../FutureValue";
import { SettableState, stateTag } from "../state";
import { StateAccess } from "../StateAccess";

export class UpdatableDerivedState<T> extends DerivedStateBase<T> implements SettableState<T> {
    
    public readonly [stateTag] = "settable";
    
    public constructor(key: string, hmrToken: object, protected readonly cfg: UpdatableDerivedStateCfg<T>) {
        super(key, hmrToken, cfg);
    }

    public set(data: DataStore, v: MaybeFutureMaterial<T>): void {
        data.assertWrite(this);
        const val = FutureValue.wrapMaybe(v);
        if (val.state === "pending") {
            if (this.cfg.onPending) {
                StateAccess.withAccess(data, (access) => this.cfg.onPending(access.toWriteAccess(), val));
            }
            val.then(s => this.set(data, s));
        } else {
            StateAccess.withAccess(data, (access) => this.cfg.onSet(access.toWriteAccess(), val));
        }
        data.note(this); //Noting has meaning only during SSR, and only time the state can be set is during initialization
    }

}
