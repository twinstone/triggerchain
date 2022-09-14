import React, { PropsWithChildren, ReactNode, Suspense } from "react";
import { DataStore } from "./DataStore";
import { useDataStore } from "./hooks";

export const DataSuspense: React.FC<PropsWithChildren<{fallback?: ReactNode}>> = (props) => {
        return (
            <Suspense fallback={props.fallback}>
                <DataSuspenseInner>
                    {props.children}
                </DataSuspenseInner>
            </Suspense>
        );
}

const DataSuspenseInner: React.FC<PropsWithChildren<{}>> = (props) => {
    const data = useDataStore();
    return (
        <>
            {props.children}
            {/* <script dangerouslySetInnerHTML={{__html: data.serializeRecords()}}/> */}
        </>
    );
}

