import { DataStore } from "./DataStore";
import { FutureResource } from "./FutureResource";
import { SerializationCfg } from "./SerializationCfg";


export interface ReadableState<T> {
    readonly key: string;
    get(data: DataStore): FutureResource<T>;
    subscribe(data: DataStore, callback: () => void): () => void;
    refresh(data: DataStore): void;
}
