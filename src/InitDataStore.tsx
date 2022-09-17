import React, { PropsWithChildren } from "react";
import { InitAccess } from "./access";
import { DataStore } from "./DataStore";
import { DataStoreContext } from "./DataStoreContext";
import { StateAccess } from "./StateAccess";

interface InitDataStoreProps {
    ssr?: boolean;
    init?: (access: InitAccess) => void;
    ssrCached?: React.MutableRefObject<() => string>;
}

export class InitDataStore extends React.Component<PropsWithChildren<InitDataStoreProps>, {dataStore: DataStore | undefined}> {
    
    public constructor(props: PropsWithChildren<InitDataStoreProps>) {
        super(props);
        this.state = {dataStore: undefined};
    }

    public componentDidMount() {
        const store = InitDataStore.createDataStore(this.props);
        this.setState({dataStore: store});
    }

    public componentWillUnmount() {
        if (this.state.dataStore) {
            this.state.dataStore.dispose();
        }
    }

    public render(): React.ReactNode {
        if (!this.state.dataStore) return null;
        return (
            <DataStoreContext.Provider value={this.state.dataStore}>
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
        datastore.initialize();
        if (props.ssrCached) {
            props.ssrCached.current = () => datastore.serializeRecords(true);
        }
        return datastore;
    }
    
}


