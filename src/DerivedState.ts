import { DerivedStateCfg, InitializeStateCfg } from "./configurations";
import { DataStore } from "./DataStore";
import { DerivedStateBase } from "./DerivedStateBase";
import { FutureResource } from "./FutureResource";
import { stateTag } from "./state";
import { StateAccessWithDeps } from "./StateAccessWithDeps";

export class DerivedState<T> extends DerivedStateBase<T> {
    
    public readonly [stateTag] = "readable";

    public constructor(key: string, hmrToken: object, protected readonly cfg: DerivedStateCfg<T>) {
        super(key, hmrToken, cfg);
    }
}
