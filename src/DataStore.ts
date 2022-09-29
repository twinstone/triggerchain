import { EffectCancel } from "./effect";
import { SerializationCfg } from "./SerializationCfg";
import { SettableState } from "./state";
import { StateBase } from "./states/StateBase";
import { StateRecord } from "./StateRecord";
import { ValueStore } from "./ValueStore";

declare global {
    interface Window {
      [ssrCacheGlobalName]?: Record<string, StateRecord>;
    }
  }

 
export class DataStore {

    private values = new Map<string, ValueStore<any>>();
    private serialized = new Map<string, "full" | "deps">();
    private recorderScriptEmited: boolean = false;
    private notes: Array<StateBase<any>> = [];
    private initialized: boolean = false;

    /**
     * 
     * @param ssr 
     * @param ssrCache data cached during SSR. This is used to avoid recomputing data during initial rendering on client.
     */
    public constructor (public readonly ssr: boolean) {
    }

    public find<T>(key: string, create: true): ValueStore<T>;
    public find<T>(key: string): ValueStore<T> | undefined;
    public find<T>(key: string, create?: boolean): ValueStore<T> | (typeof create extends true ? never : undefined) {
        let store = this.values.get(key);
        if (!store && !create) return undefined as any;
        if (!store) this.values.set(key, store = new ValueStore<T>(this, key));
        return store as any;
    }

    public findWithCached<T>(key: string, pickler: SerializationCfg<T> | undefined): ValueStore<T> {
        let store = this.find<T>(key, true);
        if (this.ssr || store.isInit) return store;
        const cached = window[ssrCacheGlobalName]?.[key];
        if (!cached) return store;
        console.log(`Restoring ${key} from cache`);
        for (const dep of cached.dependencies || []) {
            store.addDependency(dep);
            this.findWithCached(dep, undefined);
        }
        cached.dependencies = []; // to avoid re-setting dependencies later
        if (cached.error) {
            store.setError(new Error(cached.data));
            delete window[ssrCacheGlobalName]![key];
        } else {
            if ("data" in cached && pickler) {
                const value = pickler.unpickle(cached.data);
                store.setValue(value);
            }
            if (("data" in cached) === !!pickler) {
                delete window[ssrCacheGlobalName]![key];
            }
        }
        return store;
    }

    public assertWrite(state: SettableState<any>): void {
        if (this.ssr && this.initialized) {
            throw new Error(`Cannot write to state ${state.key} in SSR mode`);
        }
    }

    public initialize(): void {
        this.initialized = true;
    }

    //TODO Note automatically in find methods?
    public note(state: StateBase<any>) {
        if (this.ssr) {
            //console.log(`Recording ${state.key} ${qualifier}`);
            this.notes.push(state);
        }
    }

    protected serializeState(state: StateBase<any>, last: boolean): string | undefined {
        const pickler = state.pickler();
        const mode = pickler ? "full" : "deps";
        const prev = this.serialized.get(state.key);
        if (prev === mode) return "";
        if (prev) throw Error("Different serialization mode");
        const store = this.find(state.key);
        if (!store) throw new Error(`Cannot serialize state ${state.key} because it has no value`);
        this.serialized.set(state.key, mode);
        const deps = store.upDependencies;
        let record: StateRecord;
        const value = store.get().current();
        switch (value.state) {
            case "pending":
                if (last) {
                    throw new Error(`Cannot serialize state ${state.key} because its value is not available`);
                }
                return undefined;
            case "error":
                record = {dependencies: deps, error: true, data: "" + value.error};
                break;
            case "present":
                //TODO do not serialize if no dependencies and no value pickler
                if (pickler) {
                    record = {dependencies: deps, data: pickler.pickle(value.value)};
                } else {
                    record = {dependencies: deps};
                }
                break;
        }
        return `addToSsrDataCache("${state.key}", ${JSON.stringify(record)});` + "\n";
    }

    /**
     * Serializes states notes so far that already settled. Non-settled states are retain for
     * later serialization. States having picker are serialized completely, only dependencies
     * are serialized for others.
     * Note that it is not possible that state dependencies of state A are not serialized but A is.
     * Under non-setting condition in SSR mode, this would violate the assumption that all dependecies
     * of state A must be settled before A is settled.
     * @param last true if this is the last time the state is serialized. It is an
     *  error, to have pending states at this time.
     * @returns script that sets SSR cache in client.
     */
    public serializeRecords(last: boolean): string {
        let script = "";
        const newNotes:Array<StateBase<any>> = [];

        if (!this.ssr) return "";
        if (!this.recorderScriptEmited) {
            this.recorderScriptEmited = true;
            script = `
            var ${ssrCacheGlobalName} = {};
            function addToSsrDataCache(key, value) {
                ${ssrCacheGlobalName}[key] = value;
            }
            `;
        }
        for (const note of this.notes) {
            const scr = this.serializeState(note, last);
            if (scr === undefined) {
                newNotes.push(note);
            } else {
                script += scr;    
            }
        }
        this.notes = newNotes;
        return script;
    }

    private batchCount = 0;
    private batchRunning: boolean = false;
    private batchNotifications: Set<() => void> = new Set();
    private batchDependencies: Map<string, ValueStore<any>> = new Map();

    protected doNotifications() {
        this.batchRunning = true;
        try {
            while (this.batchDependencies.size > 0) {
                const deps = this.batchDependencies;
                this.batchDependencies = new Map();
                for (const vs of deps.values()) {
                    try {
                        vs.invalidate();
                    } catch (err) {
                        console.error("Error during invalidation " + vs.key, err);
                    }
                }
            }
        } finally {
            this.batchRunning = false;
        }
        const nots = this.batchNotifications;
        this.batchNotifications = new Set();
        for (const n of nots.values()) {
            try {
                n();
            } catch (err) {
                console.error("Error during notification", err);
            }
        }
    }

    /**
     * Start accumulating notifications
     */
    public startBatch() {
        this.batchCount++;
    }

    public endBatch() {
        if (!this.batchCount) throw new Error("Batch has not started");
        this.batchCount--;
        if (!this.batchCount) {
            this.doNotifications();
        }
    }

    public notify(nots: Array<() => void>, deps: ValueStore<any>[]) {
        nots.forEach(n => this.batchNotifications.add(n));
        deps.forEach(d => this.batchDependencies.set(d.key, d));
        if (this.batchCount === 0 && !this.batchRunning) {
            this.doNotifications();
        }
    }

    private events = new WeakMap<object, Record<string, BCast>>();

    /**
     * Due to contravariance of function parameters, target's addEventListener must be passed as parameter of
     * another function to allow proper event type inference?
     * See https://github.com/microsoft/TypeScript/issues/32164
     * See https://stackoverflow.com/questions/52760509/typescript-returntype-of-overloaded-function
     * 
     * @param target 
     * @param f 
     * @returns 
     */
    public addBroadcast<E extends EventTarget>(target: E, block: (add: E["addEventListener"]) => void): EffectCancel {
        const self = this;
        let removes: Array<() => void> = [];
        
        function adder(type: string, listener: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean) {
            //TODO instead of throwing exception group listeners with same options toghether.
            if (options) {
                throw new Error("Listener options are not supported.")
            }
            if (!listener) {
                throw new Error("Listener have to be specified.")
            }
            if (!self.events.has(target)) {
                self.events.set(target, {});
            }
            const rec = self.events.get(target)!;
            if (!rec[type]) {
                const target = new EventTarget();
                const cast: BCast = {
                    count: 0,
                    events: target,
                    callback: (e) => {
                        self.startBatch();
                        try {
                            target.dispatchEvent(e);
                        } finally {
                            self.endBatch();
                        }
                    }
                }
                rec[type] = cast;
                target.addEventListener(type, cast.callback);
            }
            const cast = rec[type]!;
            cast.events.addEventListener(type, listener);
            cast.count++;
            removes.push(() => self.removeBroadcast(target, type, listener));
        }
        block(adder);
        return () => removes.forEach(r => r());
    }

    protected removeBroadcast(target: EventTarget, type: string, listener: EventListenerOrEventListenerObject): void {
        //if disposed do nothing
        const rec = this.events.get(target);
        if (!rec) return;
        const cast = rec[type];
        if (!cast) return;
        cast.events.removeEventListener(type, listener);
        cast.count--;
        if (cast.count === 0) {
            target.removeEventListener(type, cast.callback);
            delete rec[type];
        }
    }

    public dispose() {
        //cancel all effects
        //unsubscribe notifications
        //remove all broadcasts
    }
}

interface BCast {
    callback: (e: Event) => void;
    events: EventTarget;
    count: number;
}

export const ssrCacheGlobalName = "ssrDataCache";

