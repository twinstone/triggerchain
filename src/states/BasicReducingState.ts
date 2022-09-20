import { InitializeStateCfg, ReducingStateCfg } from "../configurations";
import { FutureMaterial } from "../FutureValue";
import { ReducingStateBase } from "./ReducingStateBase";
import { StateAccessWithDeps } from "../StateAccessWithDeps";

export class BasicReducingState<T, C> extends ReducingStateBase<T, C> {
    
    public constructor (key: string, hmrToken: object, protected readonly cfg: ReducingStateCfg<T, C>) {
        super(key, hmrToken);
    }

    protected reductionFn(command: C): (access: StateAccessWithDeps, last: T) => FutureMaterial<T> {
        return (access, last) => this.cfg.reduce(access.toReduceAccess(), last, command);
    }

    protected initCfg(): InitializeStateCfg<T> {
        return this.cfg;
    }

}