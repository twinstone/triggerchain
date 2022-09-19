import { DataStore } from "./DataStore";
import { MaybeFutureMaterial } from "./FutureValue";
import { StateBase } from "./StateBase";

export abstract class ReducingStateBase<T> extends StateBase<T> {
    public constructor (key: string, hmrToken: object) {
        super(key, hmrToken);
    }

    public set(data: DataStore, v: MaybeFutureMaterial<T>): void {
        // See BasicState.set
        data.assertWrite(this);
        this.setInternal(data, v);
    }
}