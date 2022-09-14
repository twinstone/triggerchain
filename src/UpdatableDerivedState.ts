import { WriteAccess } from "./access";
import { DataStore } from "./DataStore";
import { DerivedState, DerivedStateCfg } from "./DerivedState";
import { FutureMaterial } from "./FutureValue";
import { Qualifier } from "./Qualifier";
import { SettableState } from "./SettableState";

export interface UpdatableDerivedStateCfg<T> extends DerivedStateCfg<T> {
    //readonly onSet: (access: WriteAccess, q: Qualifier, value: MaybeFutureValue<T>) => void
    readonly onSet: (access: WriteAccess, q: Qualifier, value: T) => void;
    readonly onIvalidate?: (access: WriteAccess, q: Qualifier) => void;
    readonly onSetError?: (access: WriteAccess, q: Qualifier, error: unknown) => void;
}


export class UpdatableDerivedState<T> extends DerivedState<T> implements SettableState<T> {
    public constructor(key: string, protected readonly cfg: UpdatableDerivedStateCfg<T>) {
        super(key, cfg);
    }

    protected createAccess(data: DataStore): WriteAccess {
        return {
            set<T>(state: SettableState<T>, value: FutureMaterial<T>): void {
                state.set(data, qualifier ?? Qualifier.empty, value);
            },
            invalidate(state: SettableState<any>, qualifier?: Qualifier): void {
                //TODO
            },
            setError(state: SettableState<any>, qualifier?: Qualifier): void {
                //TODO
            },
        };
    }

    public setError(data: DataStore, q: Qualifier, e: unknown): void {
        data.assertWrite(this, q);
        const access = this.createAccess(data);
        this.cfg.onSetError && this.cfg.onSetError(access, q, e)
    }

    public set(data: DataStore, q: Qualifier, v: T | Promise<T>): void {
        data.assertWrite(this, q);
        const access = this.createAccess(data);
        if (v instanceof Promise) {
            if (this.cfg.onIvalidate) {
                this.cfg.onIvalidate(access, q);
            }
            v.then(
                value => this.cfg.onSet(access, q, value),
                error => this.cfg.onSetError && this.cfg.onSetError(access, q, error),
            );
        } else {
            this.cfg.onSet(access, q, v);
        }
        data.note(this, q); //Noting has meaning only during SSR, and only time the state can be set is during initialization
    }

}
