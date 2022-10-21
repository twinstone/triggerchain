import { CancelError } from "./CancelError";
import { DataStore } from "./DataStore";
import { FutureResource } from "./FutureResource";
import { FutureMaterial, FutureValue, MaybeFutureValue, MaybeSettledValue, PendingValue, SettledValue } from "./FutureValue";
import { PromiseExt } from "./PromiseExt";
import { cancelPromise, isPromiseCanceled, safeCancelable } from "./promiseTools";

export type ValueStoreState = "init" | "invalid" | "pending" | "settled" | "cancel";

export class ValueStore<T> {
    public readonly key: string;
    private state: ValueStoreState;
    private resource: PromiseExt<T>;
    private fiber: Omit<FutureResource<T>, "current"> | undefined;
    //If present restart function must immediatelly call some of set* methods
    private restart: (() => void) | undefined;
    private subscriptions: Array<() => void>;
    public upDependencies: Array<string>; //Only for SSR
    private downDependencies: Array<ValueStore<any>>;
    private invalidCount = 0;
    public lastSettled: MaybeSettledValue<T> = FutureValue.noValue();

    public constructor(private readonly data: DataStore, key: string) {
        this.key = key;
        this.state = "init";
        this.resource = new PromiseExt<T>(`${key}/${this.invalidCount++}`);
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
        if (this.fiber && this.resource.isSettled) {
            console.error(`Invalid state of ${this.key}, fiber exists but resource is settled`);
        }
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
                console.error("Restart function failed to set value state for " + this.key);
                this.state = prev;
            }
            return true;
        }
        if (!this.resource.isSettled) {
            console.error(`Value Store ${this.key} has no restart function, cancelling main promise`);
            this.resource.cancel();
        }
        return false;
    }

    protected setSettled(): void {
        this.assertSettable();
        this.state = "settled";
        this.restart = undefined;
        this.fiber = undefined;
    }

    protected assertSettable(): void {
        if (!this.shouldRecompute) throw Error(`Illegal store ${this.key} state: ${this.state}`);
    }

    public setValue(v: T): void {
        this.setSettled();
        this.lastSettled = FutureValue.fromValue(v);
        this.resource.resolve(v);
    }

    public setError(e: unknown): void {
        this.setSettled();
        this.lastSettled = FutureValue.fromError(e);
        this.resource.reject(e);
    }

    public get(): FutureResource<T> {
        return this.resource;
    }

    public set(v: MaybeFutureValue<T>, restart?: () => void): void {
        switch (v.state) {
            case "nothing":
                this.invalidate(true);
                this.lastSettled = FutureValue.noValue();
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

    protected settle<T>(p: Promise<T>, fn: (fv: SettledValue<T>) => void) {
        const current = this.fiber;
        p.then(
            v => {
                if (current === this.fiber) {
                    fn(FutureValue.fromValue(v))
                }
            },
            e => {
                if (current === this.fiber) {
                    fn(FutureValue.fromError(e))
                } else {
                    if (e instanceof CancelError) {}
                    else if ("name" in e && e["name"] === "AbortError") {}
                    else console.warn("Error in canceled fiber of " + this.key, e);
                }
            },
        );
    }
    
    public loop(src: () => FutureMaterial<T>, restart?: () => void) {
        this.assertSettable();
        this.loopInternal(src, restart);
    }

    protected loopInternal(src: () => FutureMaterial<T>, restart: (() => void) | undefined) {
        const fv = FutureValue.tryFutureValue(src);
        if (fv.state === "error" && fv.error instanceof Promise) {
            this.state = "pending";
            this.restart = restart;
            const p = safeCancelable(fv.error);
            this.fiber = {
                cancel: () => cancelPromise(p),
                isCanceled: () => isPromiseCanceled(p),
            }
            this.settle(p, () => this.loopInternal(src, restart));
        } else {
            this.state = "invalid"; //prevent failing settable test
            this.set(fv, restart);
        }
    }

    public setPromise(v: Promise<T> | PendingValue<T>, restart?: () => void) {
        this.assertSettable();
        this.state = "pending";
        this.restart = restart;
        const fv = v instanceof Promise ? FutureValue.fromPromise(v) : v;
        this.fiber = FutureResource.fromPending(fv);
        this.settle(fv.promise, res => {
            if (this.state !== "pending") console.error("Fiber settled, invalid state: " + this.state);
            this.state = "invalid"; //to fullfill state checks
            this.set(res);
        });
    }

    //Invalidate downstream subtree and then call subscriptions
    //Subcsriptions may (and will) call State.get, and we don't want to
    //interleave invalidation and revalidation of stored value.
    public invalidate(skipRestart?: boolean): void {
        if (this.state === "invalid") return;
        console.log(`Invalidating ${this.key}. ${this.upDependencies.length} up-dependencies, ${this.downDependencies.length} down-dependencies, ${this.subscriptions.length} subscriptions.`);
        if (this.fiber && this.state !== "pending") {
            console.error(`Fiber of value ${this.key} in invalid state: ${this.state}`);
        }
        if (this.cancelFiber(skipRestart ?? false)) return;            
        // if (!this.resource.isSettled && this.state !== "init") {
        //     console.error(`Promise of ${this.key} not settled, cancelling`);
        //     this.resource.cancel();
        // }
        this.state = "invalid";
        if (this.resource.isSettled) {
            this.resource = new PromiseExt<T>(`${this.key}/${this.invalidCount++}`);
        }
        this.upDependencies = [];
        const ddeps = this.downDependencies;
        this.downDependencies = [];    
        this.data.notify(this.subscriptions, ddeps);
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

    public assertWrite(init: boolean): void {
        if (this.data.ssr) {
            if (!init || this.state !== "init") {
                throw new Error(`Cannot write to state ${this.key} in SSR mode`);
            }
        }
    }
}
