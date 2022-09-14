import { ReadAccess } from "./access";
import { DataStore } from "./DataStore";
import { FutureResource } from "./FutureResource";
import { PromiseExt } from "./PromiseExt";
import { Qualifier } from "./Qualifier";
import { SerializationCfg } from "./SerializationCfg";
import { StateBase } from "./StateBase";
import { ValueStore } from "./ValueStore";
import { ValueAccessWithDeps } from "./ValueAccessWithDeps";

export interface DerivedStateCfg<T> {
    readonly derive: (access: ReadAccess, q: Qualifier) => T | Promise<T>;
    readonly pickler?: SerializationCfg<T>;
}

export class DerivedState<T> extends StateBase<T> {
    public constructor(key: string, hmrToken: object, protected readonly cfg: DerivedStateCfg<T>) {
        super(key, hmrToken);
    }

    public pickler(): SerializationCfg<T> | undefined {
        return this.cfg.pickler;
    }
    
    public get(data: DataStore): FutureResource<T> {
        const store = data.findWithCached<T>(this.key, q, this.pickler());
        //console.log(`get ${this.key} ${q}`, store.invalid, store.value.state);
        if (store.invalid) {
            const access = new ValueAccessWithDeps(data, store);
            try {
                const value = this.cfg.derive(access, q);
                store.setValueOrPromise(value);
            } catch (e) {
                if (e instanceof Promise) {
                    store.setPending();
                    this.asyncLoop(e, store, store.promise, access, q);
                } else {
                    store.setError(e);
                }
            }
        }
        data.note(this, q);
        return store.promise;
    }

    /**
     *
     * @param e
     * @param store
     * @param target target promise captured at time when attempt to recalculate was made. If store contains another promise, do not update the store (this fiber was cancelled)
     */
    protected async asyncLoop(e: Promise<any>, store: ValueStore<T>, target: PromiseExt<T>, access: ValueAccessWithDeps, q: Qualifier): Promise<void> {
        try {
            try {
                await e;
            } catch {
                // TODO remove when store.promise ceases being canceled
                console.warn(`Signalling promise error in async loop of ${this.key}/${q}`, e);
            }
            if (store.promise === target) {
                const value = this.cfg.derive(access, q);
                store.setValueOrPromise(value);
            }
        } catch (e) {
            if (store.promise === target) {
                if (e instanceof Promise) {
                    this.asyncLoop(e, store, target, access, q);
                } else {
                    store.setError(e);
                }
            } else {
                if (!(e instanceof Promise)) {
                    console.error(`Error in cancelled async loop of ${this.key}/${q}`, e);
                }
            }
        }
    }

}
