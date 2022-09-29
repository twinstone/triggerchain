import { fail } from "./utils";
import { FutureValue } from "./FutureValue";
import { FutureResource } from "./FutureResource";
import { CancelError } from "./CancelError";
import { makeCancelable } from "./promiseTools";

export class PromiseExt<T> implements FutureResource<T> {
    private rej?: (e: unknown) => void;
    private res?: (v: T) => void;
    private prom: Promise<T>;
    private done: boolean = false;
    private future: FutureValue<T>;
    private canceled: boolean = false;

    public constructor(id: string) {
        this.prom = new Promise<T>((res, rej) => {
            this.res = res;
            this.rej = rej;
        });
        (this.prom as any).id = id;
        //Do not allow to cancel the promise outside this class
        //The promise represents pending calculation not resource counsumption.
        //Real work is done in fibers, which are cancelled during invalidation
        //TODO consider to cancel current fiber
        this.future = FutureValue.fromPromise(makeCancelable(this.prom));
    }

    isCanceled(): boolean {
        return this.canceled;
    }

    cancel(): void {
        if (!this.canceled) {
            this.canceled = true;
            if (!this.done) this.rejectInternal(new CancelError("Canceled promise"));
        }
    }

    private assertDone(): void {
        if (this.done) {
            throw new Error("Promise already settled or connected");
        }
    }

    public get promise(): Promise<T> {
        return this.prom;
    }

    public get isSettled(): boolean {
        return this.done;
    }

    public resolve(v: T): void {
        this.assertDone();
        this.resolveInternal(v);
    }

    private resolveInternal(v: T) {
        this.done = true;
        this.future = FutureValue.fromValue(v);
        (this.res ?? fail("Too early"))(v);
    }

    public reject(e: unknown): void {
        this.assertDone();
        this.rejectInternal(e);
    }

    private rejectInternal(e: unknown) {
        this.done = true;
        this.future = FutureValue.fromError(e);
        (this.rej ?? fail("Too early"))(e);
    }

    public connect(other: Promise<T>): void {
        this.assertDone();
        this.done = true;
        other.then(
            v => this.resolveInternal(v),
            e => this.rejectInternal(e));
    }

    public current(): FutureValue<T> {
        return this.future;
    }
}
