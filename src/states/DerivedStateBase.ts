import { DerivedStateCfg, InitializeStateCfg } from "../configurations";
import { DataStore } from "../DataStore";
import { FutureResource } from "../FutureResource";
import { MaybeFutureMaterial } from "../FutureValue";
import { StateAccessWithDeps } from "../StateAccessWithDeps";
import { ValueStore } from "../ValueStore";
import { StateBase } from "./StateBase";

export abstract class DerivedStateBase<T> extends StateBase<T> {
    
    public constructor(key: string, hmrToken: object, protected readonly cfg: DerivedStateCfg<T>) {
        super(key, hmrToken);
    }

    protected initCfg(): InitializeStateCfg<T> {
        throw new Error("Unsupported in derived state");
    }

    protected setInternal(data: DataStore, store: ValueStore<T>, v: MaybeFutureMaterial<T>): void {
        throw new Error("Can not directly set value of deried state: " + this.key);
    }

    public get(data: DataStore): FutureResource<T> {
        const store = data.findWithCached<T>(this.key, this.cfg.pickler);
        //console.log(`get ${this.key} ${q}`, store.invalid, store.value.state);
        if (store.shouldRecompute) {
            const access = new StateAccessWithDeps(data, store);
            store.loop(
                () => {
                    access.startLoop(this);
                    return this.cfg.derive(access.toReadAccess());
                },
                () => this.get(data),
            );
        }
        data.note(this);
        return store.get();
    }
}
