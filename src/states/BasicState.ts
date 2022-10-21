import { BasicStateCfg, InitializeStateCfg } from "../configurations";
import { InitializableState, stateTag } from "../state";
import { StateBase } from "./StateBase";

export class BasicState<T> extends StateBase<T> implements InitializableState<T> {

    public readonly [stateTag] = "initializable";
    
    public constructor(key: string, hmrToken: object, protected readonly cfg: BasicStateCfg<T>) {
        super(key, hmrToken);
    }

    protected initCfg(): InitializeStateCfg<T> {
        return this.cfg;
    }

}
