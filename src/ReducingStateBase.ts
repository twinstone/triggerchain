import { InitializeStateCfg } from "./configurations";
import { DataStore } from "./DataStore";
import { FutureResource } from "./FutureResource";
import { FutureMaterial, FutureValue, MaybeFutureMaterial, MaybeFutureValue } from "./FutureValue";
import { ReducingState, stateTag } from "./state";
import { StateAccessWithDeps } from "./StateAccessWithDeps";
import { StateBase } from "./StateBase";
import { ValueStore } from "./ValueStore";

export abstract class ReducingStateBase<T, C> extends StateBase<T> implements ReducingState<T, C> {

    public readonly [stateTag] = "reducing";

    public constructor (key: string, hmrToken: object) {
        super(key, hmrToken);
    }

    protected doReduce(data: DataStore, store: ValueStore<T>, perform: (access: StateAccessWithDeps, last: T) => FutureMaterial<T>, last: FutureResource<T>, restart?: () => void): void {
        const access = new StateAccessWithDeps(data, store);
        
        const loopFun: () => FutureMaterial<T> = () => {
            const lastValue = FutureValue.dangerouslyUnwrap(last.current());
            access.startLoop(this);
            return perform(access, lastValue);
        };
        
        store.loop(loopFun, restart);
    }

    protected abstract reductionFn(command: C): (access: StateAccessWithDeps, last: T) => FutureMaterial<T>;

    protected getLast(data: DataStore, store: ValueStore<T>): FutureResource<T> {
        let last: MaybeFutureValue<T> = store.lastSettled;
        if (last.state === "nothing") {
            last = this.computeInit(data);
        }
        if (last.state === "nothing") {
            throw new Error("Can not reduce - missing initial value");
        }
        return FutureResource.wrap(last);
    }

    public reduce(data: DataStore, command: C): void {
        data.assertWrite(this);
        const store = data.findWithCached(this.key, this.cfg.pickler);
        if (!store.shouldRecompute) store.invalidate(true);
        const last = this.getLast(data, store);
        this.doReduce(
            data,
            store,
            (access, last) => this.reductionFn(command)(access, last),
            last,
            () => this.reduce(data, command)
        );
        data.note(this); //Noting has meaning only during SSR, and only time the state can be set is during initialization
    }

    public set(data: DataStore, v: MaybeFutureMaterial<T>): void {
        // See BasicState.set
        data.assertWrite(this);
        this.setInternal(data, v);
    }
}