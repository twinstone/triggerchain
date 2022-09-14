import React from "react";
import { DataStore } from "./DataStore";

export const DataStoreContext = React.createContext<DataStore | undefined>(undefined);