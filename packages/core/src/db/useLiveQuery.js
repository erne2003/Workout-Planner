import { useEffect, useRef, useState } from "react";
import { subscribeToChanges } from "./events.js";

/**
 * Run an async local-database query and re-run it whenever one of `tables`
 * changes (a local write, rows applied by sync, or a wipe).
 *
 *   const { data, loading } = useLiveQuery(() => workouts.list(), ["workouts", "workout_sets"]);
 *
 * @param {() => Promise<any>} query - read it anew on every run (latest closure is used)
 * @param {string[]} tables - tables whose changes invalidate the result
 * @param {any[]} [deps] - extra values that should trigger a re-run when they change
 * @returns {{ data: any, loading: boolean, error: Error | null }}
 *   `loading` is true only until the first result; later re-runs keep the
 *   previous data on screen until the new result arrives.
 */
export function useLiveQuery(query, tables, deps = []) {
  const [state, setState] = useState({ data: undefined, loading: true, error: null });
  const queryRef = useRef(query);
  queryRef.current = query;
  const tablesKey = tables.join(",");

  useEffect(() => {
    let active = true;
    let latest = 0;

    const run = () => {
      const ticket = ++latest;
      Promise.resolve()
        .then(() => queryRef.current())
        .then(
          (data) => {
            if (active && ticket === latest) setState({ data, loading: false, error: null });
          },
          (error) => {
            if (active && ticket === latest) setState((s) => ({ ...s, loading: false, error }));
          }
        );
    };

    run();
    const watched = new Set(tablesKey.split(","));
    const unsubscribe = subscribeToChanges((changed) => {
      for (const table of changed) {
        if (watched.has(table)) {
          run();
          return;
        }
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [tablesKey, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
