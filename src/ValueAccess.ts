import { DependencyList } from "react";
import { CallbackAccess, InitAccess, WriteAccess } from "./access";
import { DataStore } from "./DataStore";
import { FutureResource } from "./FutureResource";
import { FutureMaterial, FutureValue, MaybeFutureMaterial } from "./FutureValue";
import { ReadableState } from "./ReadableState";
import { ReducingState } from "./ReducingState";
import { SettableState } from "./SettableState";

export class ValueAccess {

    public constructor(protected readonly data: DataStore) {
    }

    public value<T>(state: ReadableState<T>): FutureValue<T> {
        const src = state.get(this.data);
        return src.current();
    }

    public set<T>(s: SettableState<T>, v: MaybeFutureMaterial<T>): void {
        s.set(this.data, v);
    }

    public reduce<T, C>(state: ReducingState<T, C>, command: C): void {
        state.reduce(command);
    }

    public refresh<T>(s: ReadableState<T>): void {
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
            value: <T>(s: ReadableState<T>) => this.value(s),
        });
    }

}
