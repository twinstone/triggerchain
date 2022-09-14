import { DataStore } from "./DataStore";
import { FutureResource } from "./FutureResource";
import { ReadableState } from "./ReadableState";
import { SerializationCfg } from "./SerializationCfg";


export abstract class StateBase<T> implements ReadableState<T> {

    protected constructor(public readonly key: string, public readonly hmrToken: object) {
    }
    
    
    public abstract get(data: DataStore): FutureResource<T>;

    public abstract pickler(): SerializationCfg<T> | undefined;

    public refresh(data: DataStore): void {
        const store = data.find(this.key);
        if (store) {
            const subs = store.invalidate();
        }
    }


    /**
     * When value is set or become pending again. If value is currently pending
     * callback will not be called.
     * @param state
     * @returns cancelation function
     */
    public subscribe(data: DataStore, callback: () => void): () => void {
        const store = data.find<T>(this.key, true);
        store.subscribe(callback);
        return () => store.unsubscribe(callback);
    }

}
