import { CallbackAccess, InitAccess, WriteAccess } from "./access";
import { DataStore } from "./DataStore";
import { FutureValue, MaybeFutureMaterial } from "./FutureValue";
import { ReadableState } from "./ReadableState";
import { ReducingState } from "./ReducingState";
import { SettableState } from "./SettableState";

export class StateAccess {

    private locked: boolean = false;

    public constructor(protected readonly data: DataStore) {
    }

    public lock(): void {
        this.locked = true;
    }

    protected assertUnlocked() {
        if (this.locked) throw new Error("Value access is locked");
    }

    protected isArray<T>(v: T | readonly T[] | []): v is readonly T[] | [] {
        return Array.isArray(v);
    }

    public value<T>(state: ReadableState<T>): FutureValue<T> {
        this.assertUnlocked();
        const res = state.get(this.data);
        return res.current();
    }

    public set<T>(s: SettableState<T>, v: MaybeFutureMaterial<T>): void {
        this.assertUnlocked();
        s.set(this.data, v);
    }

    public reduce<T, C>(state: ReducingState<T, C>, command: C): void {
        this.assertUnlocked();
        state.reduce(command);
    }

    public refresh<T>(s: ReadableState<T>): void {
        this.assertUnlocked();
        s.refresh(this.data);
    }

    public toInitAccess(): InitAccess {
        return {
            set: (s, v) => this.set(s, v),
        };
    }

    public toWriteAccess(): WriteAccess {
        const access = this.toInitAccess();
        const rest: Pick<WriteAccess, "refresh" | "reduce"> = {
            refresh: (s) => this.refresh(s),
            reduce: (s, c) => this.reduce(s, c),

        };
        return Object.assign(access, rest);
    }

    public toCallbackAccess(): CallbackAccess {
        const access = this.toWriteAccess();
        return Object.assign(access, {
            value: (s: any) => this.value(s) as any,
        });
    }

    public static withAccess<T>(data: DataStore, block: (access: StateAccess) => T): T {
        const access = new StateAccess(data);
        data.startBatch();
        try {
            return block(access);
        } finally {
            access.lock();
            data.endBatch();
        }
    }
}

//Test compilation
const a: StateAccess = null as any;
const b: CallbackAccess = a;