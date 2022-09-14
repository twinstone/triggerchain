import { DataStore } from "./DataStore";
import { MaybeFutureMaterial } from "./FutureValue";
import { ReadableState } from "./ReadableState";


export interface SettableState<T> extends ReadableState<T> {
    set(data: DataStore, v: MaybeFutureMaterial<T>): void;
}
