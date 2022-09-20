import { DerivedStateCfg } from "../configurations";
import { stateTag } from "../state";
import { DerivedStateBase } from "./DerivedStateBase";

export class DerivedState<T> extends DerivedStateBase<T> {
    
    public readonly [stateTag] = "readable";

    public constructor(key: string, hmrToken: object, protected readonly cfg: DerivedStateCfg<T>) {
        super(key, hmrToken, cfg);
    }
}
