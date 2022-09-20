import { DataStore } from "./DataStore";
import { FutureResource } from "./FutureResource";
import { MaybeFutureMaterial } from "./FutureValue";

export const stateTag = Symbol("stateTag");
export interface ReadableState<T> {
    readonly key: string;
    readonly [stateTag]: "readable" | "settable" | "reducing";
    get(data: DataStore): FutureResource<T>;
    subscribe(data: DataStore, callback: () => void): () => void;
    refresh(data: DataStore): void;
}
export interface SettableState<T> extends ReadableState<T> {
    set(data: DataStore, v: MaybeFutureMaterial<T>): void;
}

export interface ReducingState<T, C> extends ReadableState<T>, SettableState<T> {
    reduce(data: DataStore, command: C): void;
}

export function isReadableState(v: unknown): v is ReadableState<any> {
    return typeof v === "object" && !!v && stateTag in v;
}

export function isSettableState(v: unknown): v is SettableState<any> {
    return isReadableState(v) && (v[stateTag] === "settable" || v[stateTag] === "reducing");
}

export function isReducingState(v: unknown): v is ReducingState<any, any> {
    return isSettableState(v) && v[stateTag] === "reducing";
}

