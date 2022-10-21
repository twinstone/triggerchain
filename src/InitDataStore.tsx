import React, { PropsWithChildren } from "react";
import { InitAccess } from "./access";
import { DataStore } from "./DataStore";
import { DataStoreContext } from "./DataStoreContext";
import { StateAccess } from "./StateAccess";

interface InitDataStoreProps {
    ssr?: boolean;
    init?: (access: InitAccess) => void;
    ssrCached?: React.MutableRefObject<() => string>;
    ssrPass?: boolean;
}

export class InitDataStore extends React.Component<PropsWithChildren<InitDataStoreProps>> {
    
    declare context: React.ContextType<typeof DataStoreContext>;

    private dataStore: DataStore | undefined;

    public constructor(props: PropsWithChildren<InitDataStoreProps>) {
        super(props);
        this.state = {dataStore: undefined};
    }

    public componentDidMount() {
    }

    public componentWillUnmount() {
        if (this.dataStore && this.dataStore !== this.context) {
            this.dataStore.dispose();
        }
        this.dataStore = undefined;
    }

    public render(): React.ReactNode {
        if (!this.dataStore) {
            if (this.context && this.props.ssrPass) {
                this.dataStore = this.context;
            } else {
                this.dataStore = InitDataStore.createDataStore(this.props);
            }
        }
        return (
            <DataStoreContext.Provider value={this.dataStore}>
                {this.props.children}
            </DataStoreContext.Provider>
        );
    }

    protected static createDataStore(props: InitDataStoreProps): DataStore {
        const datastore = new DataStore(props.ssr ?? false);
        if (props.init) {
            const init = props.init;
            StateAccess.withAccess(datastore, (access) => init(access.toInitAccess()));
        }
        if (props.ssrCached) {
            props.ssrCached.current = () => datastore.serializeRecords(true);
        }
        return datastore;
    }
 
    public static readonly contextType = DataStoreContext;
}


