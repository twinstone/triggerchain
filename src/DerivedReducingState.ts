import { DerivedReducingStateCfg, InitializeStateCfg } from "./configurations";
import { DataStore } from "./DataStore";
import { ReducingStateBase } from "./ReducingStateBase";
import { ReducingState } from "./state";

export class DerivedReducingState<T, C> extends ReducingStateBase<T> implements ReducingState<T, C> {
    public constructor (key: string, hmrToken: object, protected readonly cfg: DerivedReducingStateCfg<T, C>) {
        super(key, hmrToken);
    }

    protected initCfg(): InitializeStateCfg<T> {
        return this.cfg;
    }

    reduce(data: DataStore, command: C): void {
        throw new Error("Method not implemented.");
    }
   
}