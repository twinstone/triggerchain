import { ReadableState } from "./ReadableState";
import { SettableState } from "./SettableState";

export interface ReducingState<T, C> extends ReadableState<T>, SettableState<T> {
    reduce(command: C): void;
}