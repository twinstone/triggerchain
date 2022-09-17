import { UpdatableDerivedStateCfg } from "./configurations";
import { DataStore } from "./DataStore";
import { DerivedState } from "./DerivedState";
import { FutureValue, MaybeFutureMaterial } from "./FutureValue";
import { SettableState } from "./SettableState";
import { ValueAccess } from "./ValueAccess";

export class UpdatableDerivedState<T> extends DerivedState<T> implements SettableState<T> {
    
    public constructor(key: string, hmrToken: object, protected readonly cfg: UpdatableDerivedStateCfg<T>) {
        super(key, hmrToken, cfg);
    }

    public set(data: DataStore, v: MaybeFutureMaterial<T>): void {
        data.assertWrite(this);
        const val = FutureValue.wrapMaybe(v);
        if (val.state === "pending") {
            if (this.cfg.onPending) {
                ValueAccess.withAccess(data, (access) => this.cfg.onPending(access.toWriteAccess(), val));
            }
            val.then(s => this.set(data, s));
            return;
        } else {
            ValueAccess.withAccess(data, (access) => this.cfg.onSet(access.toWriteAccess(), val));
        }
        data.note(this); //Noting has meaning only during SSR, and only time the state can be set is during initialization
    }

}
