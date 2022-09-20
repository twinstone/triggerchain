import { DataStore } from "../DataStore";
import { FutureResource } from "../FutureResource";
import { FutureMaterial, SettledValue } from "../FutureValue";
import { ReadableState, stateTag } from "../state";

export class SelectorState<T, R> implements ReadableState<R> {    
    public readonly key: string;
    public readonly [stateTag] = "readable";

    private values = new WeakMap<DataStore, [FutureResource<T>, FutureResource<R>]>();

    public constructor(protected readonly original: ReadableState<T>, protected readonly map: (v: SettledValue<T>) => FutureMaterial<R>) {
        this.key = original.key;
    }

    public get(data: DataStore): FutureResource<R> {
        const o = this.original.get(data);
        let p = this.values.get(data);
        if (!p || p[0] !== o) {
            const v = FutureResource.wrap(o.current().then(this.map));
            p = [o, v];
            this.values.set(data, p);
        }
        return p[1];
    }
    
    public subscribe(data: DataStore, callback: () => void): () => void {
        return this.original.subscribe(data, callback);
    }

    public refresh(data: DataStore): void {
        this.original.refresh(data);
    }   

}