## General
   * cancelable "fibers" (would require a restart function stored in ValueStore)
   * SWR - stale while revalidate mode on states (require fibers?)
   * do nothing if setting new value that is same as previous? Handle promises (SWR and no SWR)
   * collect notifications in WriteAccess, several basic states may get changed
   * access to previous value in setters? Handle situation when value was never computed or was not yet settled. 
   * reset (to initial state) and refresh API (start recalculation immediately) (or just reset(force)?)
   * ValueStore lifecycle (states) init -> invalid -> pending -> settled
   * generalize qualifier, introduce state families/groups BasicStateGroup<T, Q>(q: Q) => BasicState<T>
   * DataStore specific cache for derived values / values stores (limit number of total memoized values). Or just remove invalid items without downstream dependencies and subscriptions?
   * Callback factory (control over lifecycle of access object) vs generic "access" hook: useDataAccess => object with state setters
   * guard *Access instance lifecycle to duration of a callback. Attempt to use it outside should lead to error.
### Efects
   * subscribe to dom events
   * periodic data retrieval
   * sync state with some storage (URL, Cookie)

## BasicState
   * initialize from derived state (async loop in BaseState)
   * effects? - subscriptions to DOM, History, ...

## Derived state
   * change handler? - isn't it duplicate of another derived state? or violation of idempotency rule?

## DataStore
   * hierarchic datastore?

