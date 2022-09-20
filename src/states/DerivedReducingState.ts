import { DerivedReducingStateCfg, InitializeStateCfg } from "../configurations";
import { DataStore } from "../DataStore";
import { FutureResource } from "../FutureResource";
import { FutureMaterial, FutureValue, MaybeFutureMaterial } from "../FutureValue";
import { ReducingStateBase } from "./ReducingStateBase";
import { StateAccessWithDeps } from "../StateAccessWithDeps";

export class DerivedReducingState<T, C> extends ReducingStateBase<T, C> {
    public constructor (key: string, hmrToken: object, protected readonly cfg: DerivedReducingStateCfg<T, C>) {
        super(key, hmrToken);
    }

    protected initCfg(): InitializeStateCfg<T> {
        return this.cfg;
    }

    protected reductionFn(command: C): (access: StateAccessWithDeps, last: T) => FutureMaterial<T> {
        return (access, last) => this.cfg.reduce(access.toDerivedReadAccess(), last, command);
    }
   
    public get(data: DataStore): FutureResource<T> {
        const store = data.findWithCached<T>(this.key, this.cfg.pickler);
        //console.log(`get ${this.key} ${q}`, store.invalid, store.value.state);
        if (store.shouldRecompute) {
            const last = this.getLast(data, store);
            this.doReduce(
                data,
                store,
                (access, last) => this.cfg.reduce(access.toDerivedReadAccess(), last),
                last,
                () => this.get(data),
            );
        }
        data.note(this);
        return store.get();
    }

    public set(data: DataStore, v: MaybeFutureMaterial<T>): void {
        data.assertWrite(this);
        const store = data.find<T>(this.key, true);
        data.startBatch();
        try {
            if (!store.shouldRecompute) store.invalidate(true);
            const value = FutureValue.wrapMaybe(v);
            if (value.state === "nothing") {
                store.set(value);
            } else {
                //Perform null reduction to recompute dependencies
                const last = FutureResource.wrap(value);
                this.doReduce(
                    data,
                    store,
                    (access, last) => this.cfg.reduce(access.toDerivedReadAccess(), last),
                    last,
                    () => this.set(data, v),
                );
            }
        } finally {
            data.endBatch();
        }
        data.note(this); //Noting has meaning only during SSR, and only time the state can be set is during initialization
    }

}