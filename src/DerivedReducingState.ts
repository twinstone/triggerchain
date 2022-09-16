import { DerivedReduceAccess, ReduceAccess } from "./access";
import { DataStore } from "./DataStore";
import { FutureMaterial } from "./FutureValue";
import { FutureResource } from "./FutureResource";
import { ReducingState } from "./ReducingState";
import { ReducingStateBase } from "./ReducingStateBase";
import { SerializationCfg } from "./SerializationCfg";
import { DerivedReducingStateCfg, InitializeStateCfg } from "./configurations";

export class DerivedReducingState<T, C> extends ReducingStateBase<T, C> implements ReducingState<T, C> {
    public constructor (key: string, hmrToken: object, protected readonly cfg: DerivedReducingStateCfg<T, C>) {
        super(key, hmrToken);
    }

    protected initCfg(): InitializeStateCfg<T> {
        return this.cfg;
    }

    reduce(command: C): void {
        throw new Error("Method not implemented.");
    }
   
}