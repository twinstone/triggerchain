import { InitializeStateCfg, StateCfgBase } from "./configurations";
import { DataStore } from "./DataStore";
import { FutureResource } from "./FutureResource";
import { FutureValue, MaybeFutureMaterial, MaybeFutureValue } from "./FutureValue";
import { ReadableState } from "./ReadableState";
import { ValueAccess } from "./ValueAccess";

function isFunction<T>(v: MaybeFutureMaterial<T> | (() => MaybeFutureMaterial<T>)): v is () => MaybeFutureMaterial<T> {
    return typeof v === "function";
}

export abstract class StateBase<T> implements ReadableState<T> {

    protected constructor(public readonly key: string, public readonly hmrToken: object) {
    }

    protected abstract cfg: StateCfgBase<T>;

    protected abstract initCfg(): InitializeStateCfg<T>;

    protected computeInit(): MaybeFutureValue<T> {
        const cfg = this.initCfg();
        if (!cfg.init) return FutureValue.noValue;
        const v = isFunction(cfg.init) ? FutureValue.tryMaybeFutureValue(cfg.init) : FutureValue.wrapMaybe(cfg.init);
        return v;
    }

    public get(data: DataStore): FutureResource<T> {
        const store = data.findWithCached<T>(this.key, this.cfg.pickler);
        if (store.state === "init" || store.state === "invalid") {
            const init = this.computeInit();
            if (store.state === "init" && FutureValue.hasNoValue(init) && data.ssr) {
                throw new Error(`State ${this.key} was not set and there is no way to initialize it`);
            }
            store.set(init);
        } 
        data.note(this);
        return store.promise;
    }

    public refresh(data: DataStore): void {
        const store = data.find(this.key);
        if (store) {
            const subs = store.invalidate();
        }
    }

    
    /**
     * When value is set or become pending again. If value is currently pending
     * callback will not be called.
     * @param state
     * @returns cancelation function
     */
    public subscribe(data: DataStore, callback: () => void): () => void {
        const store = data.find<T>(this.key, true);
        store.subscribe(callback);
        return () => store.unsubscribe(callback);
    }

}
