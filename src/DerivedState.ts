import { DerivedStateCfg, InitializeStateCfg } from "./configurations";
import { DataStore } from "./DataStore";
import { FutureResource } from "./FutureResource";
import { PromiseExt } from "./PromiseExt";
import { Qualifier } from "./Qualifier";
import { StateBase } from "./StateBase";
import { StateAccessWithDeps } from "./StateAccessWithDeps";
import { ValueStore } from "./ValueStore";

export class DerivedState<T> extends StateBase<T> {
    public constructor(key: string, hmrToken: object, protected readonly cfg: DerivedStateCfg<T>) {
        super(key, hmrToken);
    }

    protected initCfg(): InitializeStateCfg<T> {
        throw new Error("Unsupported in derived state");
    }

    public get(data: DataStore): FutureResource<T> {
        const store = data.findWithCached<T>(this.key, this.cfg.pickler);
        //console.log(`get ${this.key} ${q}`, store.invalid, store.value.state);
        if (store.invalid) {
            const access = new StateAccessWithDeps(data, store);
            try {
                const value = this.cfg.derive(access.toReadAccess());
                store.setValueOrPromise(value);
            } catch (e) {
                if (e instanceof Promise) {
                    store.setPending();
                    this.asyncLoop(e, store, store.promise, access);
                } else {
                    store.setError(e);
                }
            }
        }
        data.note(this);
        return store.promise;
    }

    /**
     *
     * @param e
     * @param store
     * @param target target promise captured at time when attempt to recalculate was made. If store contains another promise, do not update the store (this fiber was cancelled)
     */
    protected async asyncLoop(e: Promise<any>, store: ValueStore<T>, target: PromiseExt<T>, access: StateAccessWithDeps): Promise<void> {
        try {
            try {
                await e;
            } catch {
                // TODO remove when store.promise ceases being canceled
                console.warn(`Signalling promise error in async loop of ${this.key}/${q}`, e);
            }
            if (store.promise === target) {
                const value = this.cfg.derive(access);
                store.setValueOrPromise(value);
            }
        } catch (e) {
            if (store.promise === target) {
                if (e instanceof Promise) {
                    this.asyncLoop(e, store, target, access);
                } else {
                    store.setError(e);
                }
            } else {
                if (!(e instanceof Promise)) {
                    console.error(`Error in cancelled async loop of ${this.key}`, e);
                }
            }
        }
    }

}
