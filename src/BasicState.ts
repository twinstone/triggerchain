import { DataStore } from "./DataStore";
import { StateEffect } from "./effect";
import { FutureResource } from "./FutureResource";
import { FutureMaterial, FutureValue, MaybeFutureMaterial } from "./FutureValue";
import { Qualifier } from "./Qualifier";
import { SerializationCfg } from "./SerializationCfg";
import { SettableState } from "./SettableState";
import { StateBase } from "./StateBase";

export interface BasicStateCfg<T> {
    readonly init?: () => FutureMaterial<T>;
    readonly pickler?: SerializationCfg<T>;
    readonly comparator?: (v1: T, v2: T) => boolean;
    readonly effects?: Array<StateEffect<T>>;
}


export class BasicState<T> extends StateBase<T> implements SettableState<T> {
    public constructor(key: string, hmrToken: object, protected readonly cfg: BasicStateCfg<T>) {
        super(key, hmrToken);
    }

    public pickler(): SerializationCfg<T> | undefined {
        return this.cfg.pickler;
    }

    public get(data: DataStore): FutureResource<T> {
        const store = data.findWithCached<T>(this.key, this.pickler());
        if (store.state === "init" && !this.cfg.init && data.ssr) {
            throw new Error(`State ${this.key} was not set and there is no way to initialize it`);
        }
        if ((store.state === "init" || store.state === "invalid") && this.cfg.init) {
            try {
                const value = this.cfg.init();
                store.set(FutureValue.wrap(value));
            } catch (e) {
                store.setError(e);
            }
        } 
        data.note(this);
        return store.promise;
    }

    public set(data: DataStore, v: MaybeFutureMaterial<T>): void {
        data.assertWrite(this);
        const store = data.find<T>(this.key, true);
        let hasPrevious = false;
        let previous: T | undefined = undefined;
        const value = store.promise.current();
        if (!store.invalid && value.state === "present") {
            hasPrevious = true;
            previous = value.value;
        }
        const subs = store.invalidate([]);
        if (v instanceof Promise) {
            store.setPromise(v);
            // if (this.cfg.onInvalidate) {
            //     this.cfg.onInvalidate(q);
            // }
            v.then(
                value => this.cfg.onSet && this.cfg.onSet(q, value),
                //error => this.cfg.onSetError && (hasPrevious ? this.cfg.onSetError(q, error, previous) : this.cfg.onSetError(q, error)),
            );
        } else {
            store.setValue(v);
            if (this.cfg.onSet) {
                if (hasPrevious) this.cfg.onSet(q, v, previous);
                else this.cfg.onSet(q, v);
            } 
        }
        data.note(this, q); //Noting has meaning only during SSR, and only time the state can be set is during initialization
        this.notify(subs);
    }

    public setError(data: DataStore, q: Qualifier, e: unknown): void {
        data.assertWrite(this, q);
        const store = data.find<T>(this.key, q, true);
        const value = store.promise.current();
        let hasPrevious = false;
        let previous: T | undefined = undefined;
        if (!store.invalid && value.state === "present") {
            hasPrevious = true;
            previous = value.value;
        }
        const subs = store.invalidate([]);
        store.setError(e);
        //this.cfg.onSetError && (hasPrevious ? this.cfg.onSetError(q, e, previous) : this.cfg.onSetError(q, e))
        data.note(this, q); //Noting has meaning only during SSR, and only time the state can be set is during initialization
        this.notify(subs);
    }
}
