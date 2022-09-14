export interface SerializationCfg<T> {
    pickle(value: T):  any;
    unpickle(value: any): T;
}

export function jsonPickler<T>(): SerializationCfg<T> {
    return {
        pickle(value: T): any {return value;},
        unpickle(value: any): T {return value as T;}
    }
}
