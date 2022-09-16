import { DependencyList } from "react";
import { ReadAccess, ReduceAccess } from "./access";
import { DataStore } from "./DataStore";
import { FutureResource } from "./FutureResource";
import { FutureMaterial, FutureValue } from "./FutureValue";
import { Qualifier } from "./Qualifier";
import { ReadableState } from "./ReadableState";
import { StateBase } from "./StateBase";
import { ValueAccess } from "./ValueAccess";
import { ValueStore } from "./ValueStore";

interface UseRecord<T> {
    resource: FutureResource<T>;
    deps: DependencyList;
}

export class ValueAccessWithDeps extends ValueAccess {

    private dependencies = new Set<string>();
    private useCounter = 0;
    private useRecords: UseRecord<any>[] = [];
    private hmrToken: WeakRef<object> | undefined = undefined;

    public constructor(data: DataStore, private readonly store: ValueStore<any>) {
        super(data);
    }

    public startLoop(state: StateBase<any>) {
        this.useCounter = 0;
        if (!this.hmrToken || this.hmrToken.deref() !== state.hmrToken) {
            this.hmrToken = new WeakRef(state.hmrToken);
            //TODO clean dependencies
            //this.dependencies = new Set();
            for (const u of this.useRecords) {
                u.resource.cancel();
            }
            this.useRecords = [];
        }
    }

    protected compareDeps(old: DependencyList, current: DependencyList): boolean {
        if (old.length !== current.length) throw new Error("Dependency list has different length. 'use' sequence mischmatch");
        for (let i = 0; i < old.length; i++) {
            if (!Object.is(old[i], current[i])) return false;
        }
        return true;
    }

    public use<T>(init: () => FutureMaterial<T>, deps: DependencyList): FutureValue<T> {
        this.assertUnlocked();
        let rec: UseRecord<T>;
        if (this.useCounter < this.useRecords.length) {
            rec = this.useRecords[this.useCounter];
            if (!this.compareDeps(rec.deps, deps)) {
                rec.resource.cancel();
                rec.resource = FutureResource.wrap(init());
                rec.deps = deps.concat([]);
            }
        } else {
            rec = {resource: FutureResource.wrap(init()), deps: deps.concat([])};
            this.useRecords.push(rec);
        }
        this.useCounter++;
        return rec.resource.current();
    }

    protected addDependency(key: string): void {
        //prevent multiple subscriptions when value of state is retrieved repeatedly
        if (!this.dependencies.has(key)) {
            this.dependencies.add(key);
            this.store.addDependency(key);
        }
    }

    public get<T>(state: ReadableState<T>): T {
        const value = this.getValue(state);
        return FutureValue.dangerouslyUnwrap(value);
    }

    public getValue<T>(state: ReadableState<T>): FutureValue<T> {
        this.assertUnlocked();
        const src = state.get(this.data);
        this.addDependency(state.key);
        return src.current();
    }

    public getMany<A extends readonly ReadableState<any>[] | []>(args: A): { -readonly [P in keyof A]: A[P] extends ReadableState<infer T> ? T : never } {
        const vals: FutureValue<any>[] = [];
        for (const s of args) {
            vals.push(this.getValue(s));
        }
        return FutureValue.dangerouslyUnwrap(FutureValue.all(vals)) as any;
    }

    public toReduceAccess(): ReduceAccess {
        return {
            unwrap: (v) => FutureValue.dangerouslyUnwrap(v),
            use: (v, d) => this.use(v, d),
            value: (s) => this.value(s),
        };
    }

    public toReadAccess(): ReadAccess {
        const access = this.toReduceAccess();
        const rest: Pick<ReadAccess, "get" | "getValue" | "getMany"> = {
            get: (s) => this.get(s),
            getValue: (s) => this.getValue(s),
            getMany: (a) => this.getMany(a)
        };
        return Object.assign(access, rest);
    }

}
