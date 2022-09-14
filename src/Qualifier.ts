
export type Primitive = string | number | boolean | undefined;
export type Qualifier = Primitive | Array<Primitive>;

export namespace Qualifier {

    export function toString(q: Qualifier): string {
        return JSON.stringify(q);
    }
    
    export function compare(q1: Qualifier, q2: Qualifier): boolean {
        const t1 = typeof q1;
        const t2 = typeof q2;
        if (t1 !== t2) return false;
        if (Array.isArray(q1) !== Array.isArray(q2)) return false;
        if (Array.isArray(q1) && Array.isArray(q2)) {
            const l1 = q1.length;
            const l2 = q2.length;
            if (l1 !== l2) return false;
            for (let i = 0; i < l1; i++) {
                if (!compare(q1[i], q2[i])) return false;
            }
            return true;
        }
        return q1 === q2;
    }
}