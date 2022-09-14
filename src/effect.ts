import { CallbackAccess } from "./access";
import { EffectTrigger } from "./EffectTrigger";
import { MaybeFutureValue, MaybeSettledValue } from "./FutureValue";
import { StateBase } from "./StateBase";

export type EffectCancel = () => void;

export interface EffectParams<T> {
    previous: MaybeSettledValue<T>;
    value: MaybeFutureValue<T>;
    init?: (v: MaybeFutureValue<T>) => void;
    update: <R>(f: (access: CallbackAccess) => R) => R;
    register: <E extends EventTarget>(target: E, block: (add: E["addEventListener"]) => void) => EffectCancel;
    ssr: boolean;
}

export type EffectFunction<T> = (params: EffectParams<T>) => (EffectCancel | void | undefined);

export type StateEffect<T> = [trigger: EffectTrigger<T>, effect: EffectFunction<T>] | EffectFunction<T>;

export class EffectEntry<T> {
    private canceler: EffectCancel | void | undefined;
    private stateRef: WeakRef<StateBase<T>>; //to detect HMR. After HMR effect should be cancelled and restarted

    public constructor (
        private trigger: EffectTrigger<T>,
        private effect: EffectFunction<T>, 
        state: StateBase<T>)
    {
        this.canceler = undefined;
        this.stateRef = new WeakRef(state);
    }

    public run(state: StateBase<T>, params: EffectParams<T>): void {
        if (state !== this.stateRef.deref()) {
            this.stateRef = new WeakRef(state);
        } else {
            const trig = this.trigger(params.previous, params.value);
            if (!trig) return;
        }
        this.cancel();
        this.canceler = this.effect(params);
    }

    public cancel() {
        if (this.canceler) {
            this.canceler();
            this.canceler = undefined;
        }
    }

    public fromEffect<T>(state: StateBase<T>, effect: StateEffect<T>): EffectEntry<T> {
        if (typeof effect === "function") {
            return new EffectEntry(EffectTrigger.always(), effect, state);
        } else {
            return new EffectEntry(effect[0], effect[1], state);
        }
    }
}