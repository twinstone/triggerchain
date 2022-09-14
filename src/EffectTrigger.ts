import { MaybeFutureValue, MaybeSettledValue } from "./FutureValue";

export type EffectTrigger<T> = (old: MaybeSettledValue<T>, current: MaybeFutureValue<T>) => boolean;

export namespace EffectTrigger {
    export function always(): EffectTrigger<any> { return () => true }
    export function once(): EffectTrigger<any> { return () => false }
    export function settled() : EffectTrigger<any> { return (o, c) => c.isSettled }
    export function settledSelector<T>(selector: (v: T) => any[]) : EffectTrigger<T> { 
        let old: any[] | undefined = undefined;
        function cmp(c: any[]) {
            const o = old;
            old = c;
            if (!o || o.length !== c.length) return true;
            for (let i = 0; i < o.length; i++) {
                if (!Object.is(o[i], c[i])) return true;
            }
            return false;
        }
        return (o, c) => {
            if (!c.isSettled) return false;
            switch (c.state) {
                case "error":
                    old = undefined;
                    return true;
                case "present":
                    return cmp(selector(c.value));
            }
        }
    }
}