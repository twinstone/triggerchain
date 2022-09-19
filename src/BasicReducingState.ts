import { InitializeStateCfg, ReducingStateCfg } from "./configurations";
import { DataStore } from "./DataStore";
import { FutureMaterial, FutureValue, MaybeFutureValue, MaybeSettledValue, SettledValue } from "./FutureValue";
import { ReducingStateBase } from "./ReducingStateBase";
import { ReducingState } from "./state";
import { StateAccessWithDeps } from "./StateAccessWithDeps";
import { isFunction } from "./utils";
import { ValueStore } from "./ValueStore";

const lastValueTag = Symbol("lastValueTag");

interface LastObj<T> {[lastValueTag]: SettledValue<T>};

function isLastObj<T>(v: unknown): v is LastObj<T> {
    return typeof v === "object" && !!v && lastValueTag in v;
}
export class BasicReducingState<T, C> extends ReducingStateBase<T> implements ReducingState<T, C> {

    public constructor (key: string, hmrToken: object, protected readonly cfg: ReducingStateCfg<T, C>) {
        super(key, hmrToken);
    }

    protected initCfg(): InitializeStateCfg<T> {
        return this.cfg;
    }

    protected doReduce(data: DataStore, store: ValueStore<T>, command: C, last: MaybeFutureValue<T>): void {
        let settledLast: SettledValue<T> | undefined; 
        const access = new StateAccessWithDeps(data, store);
        
        const loopFun: (res: unknown, err?: unknown) => FutureMaterial<T> = (res, err) => {
            if (res instanceof Promise) throw res;
            if (err) settledLast = FutureValue.fromError(err);
            if (isLastObj<T>(res)) settledLast = res[lastValueTag];
            if (!settledLast) throw Error("SHN");
            if (settledLast.state === "error") return settledLast;
            access.startLoop(this);
            const lastValue = settledLast.value;
            return this.cfg.reduce(access.toReduceAccess(), lastValue, command);
        };
        
        if (last.state === "nothing") {
            throw new Error("Can not reduce - missing initial value");
        } else {
            const lastVal = last.state === "pending" ? last.promise : {[lastValueTag]: last};
            store.loop(
                loopFun ,
                () => this.reduce(data, command),
                lastVal
            );
        }
    }

    reduce(data: DataStore, command: C): void {
        data.assertWrite(this);
        const store = data.findWithCached(this.key, this.cfg.pickler);
        if (!store.shouldRecompute) store.invalidate(true);
        let last: MaybeFutureValue<T> = store.lastSettled;
        if (last.state === "nothing") {
            last = this.computeInit();
        } 
        this.doReduce(data, store, command, last);
        data.note(this); //Noting has meaning only during SSR, and only time the state can be set is during initialization
    }

}