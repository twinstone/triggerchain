import { InitializeStateCfg, StateCfgBase } from "../configurations";
import { DataStore } from "../DataStore";
import { FutureResource } from "../FutureResource";
import { FutureMaterial, FutureValue, MaybeFutureMaterial, MaybeFutureValue } from "../FutureValue";
import { SerializationCfg } from "../SerializationCfg";
import { isReadableState, ReadableState, stateTag } from "../state";
import { isFunction } from "../utils";
import { ValueStore } from "../ValueStore";


export abstract class StateBase<T> implements ReadableState<T> {

    public abstract readonly [stateTag]: "readable" | "settable" | "initializable" | "reducing";

    protected constructor(public readonly key: string, public readonly hmrToken: object) {
    }

    protected abstract cfg: StateCfgBase<T>;

    protected abstract initCfg(): InitializeStateCfg<T>;

    public pickler(): SerializationCfg<T> | undefined {
        return this.cfg.pickler;
    }

    protected computeInit(data: DataStore): MaybeFutureValue<T> {
        const cfg = this.initCfg();
        if (!("init" in cfg)) return FutureValue.noValue();
        if (isReadableState(cfg.init)) {
            const res = cfg.init.get(data);
            return res.current();
        }
        const v = isFunction(cfg.init) ? FutureValue.tryMaybeFutureValue(cfg.init) : FutureValue.wrapMaybe(cfg.init!);
        return v;
    }

    public get(data: DataStore): FutureResource<T> {
        const store = data.findWithCached<T>(this.key, this.cfg.pickler);
        if (store.shouldRecompute) {
            const init = this.computeInit(data);
            if (store.isInit && FutureValue.hasNoValue(init) && data.ssr) {
                throw new Error(`State ${this.key} was not set and there is no way to initialize it. Use Data Store initialization or init hook.`);
            }
            store.set(init);
        } 
        data.note(this);
        return store.get();
    }

    public refresh(data: DataStore): void {
        const store = data.find(this.key);
        if (store) {
            const subs = store.invalidate();
        }
    }

    protected setInternal(data: DataStore, store: ValueStore<T>, v: MaybeFutureMaterial<T>): void {
        data.startBatch();
        try {
            if (!store.shouldRecompute) store.invalidate(true);
            const value = FutureValue.wrapMaybe(v);
            store.set(value);
        } finally {
            data.endBatch();
        }
    }

    public set(data: DataStore, v: MaybeFutureMaterial<T>): void {
        const store = data.find<T>(this.key, true);
        store.assertWrite(false);
        this.setInternal(data, store, v);
        data.note(this); //Noting has meaning only during SSR, and only time the state can be set is during initialization
    }

    public init(data: DataStore, v: FutureMaterial<T>): void {
        const store = data.find<T>(this.key, true);
        store.assertWrite(true);
        this.setInternal(data, store, v);
        data.note(this); //Noting has meaning only during SSR, and only time the state can be set is during initialization
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
