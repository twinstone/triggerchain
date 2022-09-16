import { InitializeStateCfg, ReducingStateCfg } from "./configurations";
import { DataStore } from "./DataStore";
import { FutureResource } from "./FutureResource";
import { FutureMaterial } from "./FutureValue";
import { ReducingState } from "./ReducingState";
import { ReducingStateBase } from "./ReducingStateBase";
import { SerializationCfg } from "./SerializationCfg";

export class BasicReducingState<T, C> extends ReducingStateBase<T, C> implements ReducingState<T, C> {

    public constructor (key: string, hmrToken: object, protected readonly cfg: ReducingStateCfg<T, C>) {
        super(key, hmrToken);
    }

    protected initCfg(): InitializeStateCfg<T> {
        return this.cfg;
    }

    reduce(command: C): void {
        throw new Error("Method not implemented.");
    }

}