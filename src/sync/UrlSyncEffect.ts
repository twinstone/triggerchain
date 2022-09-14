import { EffectFunction, StateEffect } from "../effect";
import { EffectTrigger } from "../EffectTrigger";
import { FutureValue } from "../FutureValue";
import { SettableState } from "../SettableState";

export interface UrlCodec<T> {
    apply(url: URL, data: T): URL;
    parse(url: URL): T;
}

export interface ParamCodec<T> {
    toString(data: T): string;
    fromString(value: string | undefined): T;
}

export namespace UrlSyncEffect {
    export function singleParam<T>(state: () => SettableState<T>, name: string, codec: ParamCodec<T>, ssrInit?: URL | (() => URL)): Array<StateEffect<T>> {
        const urlCodec: UrlCodec<T> = {
            apply(url: URL, data: T): URL {
                const ret = new URL(url);
                ret.searchParams.delete(name);
                ret.searchParams.append(name, codec.toString(data));
                return ret;
            },
            parse(url: URL): T {
                const data = url.searchParams.get(name) ?? undefined;
                return codec.fromString(data);
            }
        };
        return modifier(state, urlCodec, ssrInit);
    }

    export function modifier<T>(state: () => SettableState<T>, codec: UrlCodec<T>, ssrInit?: URL | (() => URL)): Array<StateEffect<T>> {

        const effectSubscribe: EffectFunction<T> = (params) => {
            if (params.init) {
                const url = params.ssr
                 ? (typeof ssrInit === "function" ? ssrInit() : ssrInit)
                 : new URL(window.location.href);
                if (url) params.init(FutureValue.tryValue(() => codec.parse(url)));
            }
            if (params.ssr) return;
            function callback() {
                const url = new URL(window.location.href);
                const data = codec.parse(url);
                if (data) params.update((access) => {
                    access.set(state(), data);
                });
            }
            return params.register(window, f => f("popstate", callback));
        };

        const effectSet: EffectFunction<T> = (params) => {
            if (params.value.state === "present") {
                const url = new URL(window.location.href);
                const url2 = codec.apply(url, params.value.value);
                window.history.pushState(undefined, "", url2);
            }
        };

        return [[EffectTrigger.settled(), effectSet], [EffectTrigger.once(), effectSubscribe]];
    }
}