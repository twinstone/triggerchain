import { CancelError } from "./CancelError";
import { DataStore } from "./DataStore";
import { FutureResource } from "./FutureResource";
import { FutureValue, MaybeFutureValue, PendingValue } from "./FutureValue";
import { PromiseExt } from "./PromiseExt";
import { CancelablePromise } from "./promiseTools";

export type ValueStoreState = "init" | "invalid" | "pending" | "settled";

export class ValueStore<T> {
    key: string;
    state: ValueStoreState;
    promise: PromiseExt<T>;
    fiber: FutureResource<T> | undefined;
    subscriptions: Array<() => void>;
    upDependencies: Array<string>; //Only for SSR
    downDependencies: Array<ValueStore<any>>;
    invalidCount = 0;

    public constructor(private readonly data: DataStore, key: string) {
        this.key = key;
        this.state = "init";
        this.promise = new PromiseExt<T>(`${key}/${this.invalidCount++}`);
        this.subscriptions = [];
        this.upDependencies = [];
        this.downDependencies = [];
    }

    protected setSettled(): void {
        this.state = "settled";
        this.cancelFiber();
    }

    protected cancelFiber(): void {
        if (this.fiber) {
            this.fiber.cancel();
            this.fiber = undefined;
        }
    }

    public setValue(v: T): void {
        this.setSettled();
        this.promise.resolve(v);
    }

    public set(v: MaybeFutureValue<T>): void {
        switch (v.state) {
            case "nothing":
                this.invalidate();
                break;
            case "error":
                this.setError(v.error);
                break;
            case "present":
                this.setValue(v.value);
                break;
            case "pending":
                break;
        }
    }

    public setPending(): void {
        this.state = "pending";
        this.cancelFiber();    }

    public setError(e: unknown): void {
        this.setSettled();
        this.promise.reject(e);
    }

    public setPromise(v: PendingValue<T>) {
        this.setPending();
        this.fiber = FutureResource.fromPending(v);
        const target = this.fiber;
        v.promise.then(
            v => {
                if (target === this.fiber) {
                    this.setValue(v);
                }
            },
            e => {
                if (target === this.fiber) {
                    this.setError(e);
                } else {
                    console.warn("Error in canceled fiber", e);
                }
            });
    }

    //Invalidate downstream subtree and then call subscriptions
    //Subcsriptions may (and will) call State.get, and we don't want to
    //interleave invalidation and revalidation of stored value.
    public invalidate(): void {
        console.log(`Invalidating ${this.key}. ${this.upDependencies.length} up-dependencies, ${this.downDependencies.length} down-dependencies, ${this.subscriptions.length} subscriptions.`);
        if (this.state !== "invalid") {
            this.state = "invalid";
            this.cancelFiber();
            if (this.promise.isSettled) {
                this.promise = new PromiseExt<T>(`${this.key}/${this.invalidCount++}`);
            }
            this.data.startBatch();
            try {
                this.data.notify(this.subscriptions);
                this.upDependencies = [];
                for (const ds of this.downDependencies) {
                    ds.invalidate();
                }
                this.downDependencies = [];    
            } finally {
                this.data.endBatch();
            }
        }
    }

    public addDependency(dep: string): void {
        const depStore = this.data.find(dep, true);
        //Duplicities may be caused by SSR cache - deps are added from cache and from deriving 
        //downstream states.
        if (depStore.downDependencies.indexOf(this) < 0) depStore.downDependencies.push(this);
        this.upDependencies.push(dep);
    }

    public subscribe(callback: () => void): void {
        this.subscriptions.push(callback);
    }

    public unsubscribe(callback: () => void): void {
        const pos = this.subscriptions.indexOf(callback);
        if (pos >= 0) {
            this.subscriptions.splice(pos, 1);
        }
    }
}
