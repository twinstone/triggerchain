import { CancelError } from "./CancelError";
import { DataStore } from "./DataStore";
import { FutureResource } from "./FutureResource";
import { FutureMaterial, FutureValue, MaybeFutureValue, PendingValue } from "./FutureValue";
import { PromiseExt } from "./PromiseExt";
import { cancelPromise, isPromiseCanceled, safeCancelable } from "./promiseTools";

export type ValueStoreState = "init" | "invalid" | "pending" | "settled" | "cancel";

export class ValueStore<T> {
    private readonly key: string;
    private state: ValueStoreState;
    promise: PromiseExt<T>;
    private fiber: Omit<FutureResource<T>, "current"> | undefined;
    //If present restart function must immediatelly call some of set* methods
    private restart: (() => void) | undefined;
    private subscriptions: Array<() => void>;
    public upDependencies: Array<string>; //Only for SSR
    private downDependencies: Array<ValueStore<any>>;
    private invalidCount = 0;

    public constructor(private readonly data: DataStore, key: string) {
        this.key = key;
        this.state = "init";
        this.promise = new PromiseExt<T>(`${key}/${this.invalidCount++}`);
        this.subscriptions = [];
        this.upDependencies = [];
        this.downDependencies = [];
    }

    /**
     * 
     * @param skipRestart 
     * @returns true if fiber was restarted (and state changed)
     */
    protected cancelFiber(skipRestart: boolean): boolean {
        if (this.fiber) {
            this.fiber.cancel();
            this.fiber = undefined;
        }
        if (skipRestart) return false;
        if (this.restart) {
            const prev = this.state;
            this.state = "cancel";
            this.restart();
            if (this.state === "cancel") {
                console.error("Restart function failed to set state");
                this.state = prev;
            }
            return true;
        }
        console.error("Value Store has no restart function, cancelling main promise");
        this.promise.cancel();
        return false;
    }

    protected setSettled(): void {
        this.state = "settled";
        this.cancelFiber(false);
        this.restart = undefined;
    }

    public setValue(v: T): void {
        this.setSettled();
        this.promise.resolve(v);
    }

    public setError(e: unknown): void {
        this.setSettled();
        this.promise.reject(e);
    }

    public set(v: MaybeFutureValue<T>, restart?: () => void): void {
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
                this.setPromise(v, restart);
                break;
        }
    }

    protected settle<T>(p: Promise<T>, res: (v: T) => void, rej: (e:unknown) => void) {
        const current = this.fiber;
        p.then(
            v => {
                if (current === this.fiber) {
                    res(v);
                }
            },
            e => {
                if (current === this.fiber) {
                    rej(e);
                } else {
                    if (!(e instanceof CancelError)) console.warn("Error in canceled fiber", e);
                }
            },
        );
    }
    
    public loop(src: () => FutureMaterial<T>, restart?: () => void) {
        const fv = FutureValue.tryFutureValue(src);
        if (fv.state === "error" && fv.error instanceof Promise) {
            const p = safeCancelable(fv.error);
            this.fiber = {
                cancel: () => cancelPromise(p),
                isCanceled: () => isPromiseCanceled(p),
            }
            this.settle(p, () => this.loop(src, restart), () => this.loop(src, restart));
        } else {
            this.set(fv, restart);
        }
    }

    public setPromise(v: Promise<T> | PendingValue<T>, restart?: () => void) {
        this.state = "pending";
        this.cancelFiber(false);
        this.restart = restart;
        const fv = v instanceof Promise ? FutureValue.fromPromise(v) : v;
        this.fiber = FutureResource.fromPending(fv);
        this.settle(fv.promise, v => this.setValue(v), e => this.setError(e));
    }

    public invalidate(): void {
        this.invalidateInternal(false);
    }

        //Invalidate downstream subtree and then call subscriptions
    //Subcsriptions may (and will) call State.get, and we don't want to
    //interleave invalidation and revalidation of stored value.
    protected invalidateInternal(skipRestart: boolean): void {
        if (this.state === "invalid") return;
        console.log(`Invalidating ${this.key}. ${this.upDependencies.length} up-dependencies, ${this.downDependencies.length} down-dependencies, ${this.subscriptions.length} subscriptions.`);
        if (this.state === "pending") {
            if (this.cancelFiber(skipRestart)) return;            
        }
        if (!this.promise.isSettled && this.state !== "init") {
            console.error("Promise not settled, cancelling");
            this.promise.cancel();
        }
        this.state = "invalid";
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

    public get isInit(): boolean {
        return this.state === "init";
    }

    public get shouldRecompute(): boolean {
        return this.state === "invalid" || this.state === "init" || this.state === "cancel";
    }
}
