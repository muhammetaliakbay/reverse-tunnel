import {merge, Observable} from 'rxjs';
import {flatMap, map, pairwise, scan, startWith} from 'rxjs/operators';

export function arraysDifference<T>(previous: T[], current: T[]): {
    removed: T[],
    added: T[],
    common: T[]
} {
    const removed: T[] = [];
    const added: T[] = [];
    const common: T[] = [];

    for (const s of new Set([...previous, ...current])) {
        const p = previous.includes(s);
        const c = current.includes(s);

        if (p && c) {
            common.push(s);
        } else if(p && !c) {
            removed.push(s);
        } else if(!p && c) {
            added.push(s);
        } else {
            throw new Error('bug.');
        }
    }

    return {
        removed, added, common
    }
}

export interface DifferenceObservables<T> {
    removed: Observable<T>;
    added: Observable<T>;
}

export function observableArrayDifference<T>(observable: Observable<T[]>): DifferenceObservables<T> {
    const difference = observable.pipe(
        map(arr => arr.slice()), // copy to prevent changes on origin
        startWith([]),
        pairwise(),
        map(([previous, current]) => arraysDifference(previous, current))
    );
    const removed = difference.pipe(
        flatMap(diff => diff.removed)
    );
    const added = difference.pipe(
        flatMap(diff => diff.added)
    );
    return {
        removed, added
    };
}

export interface Delta<T> {
    type: 'add' | 'remove';
    element: T;
}

export function mergeDifferenceObservables<T>(diff: DifferenceObservables<T>): Observable<Delta<T>> {
    return merge(
        diff.removed.pipe(map(element => ({
            type: 'remove',
            element
        }))),
        diff.added.pipe(map(element => ({
            type: 'add',
            element
        })))
    ) as Observable<Delta<T>>;
}

export function reconstructDeltaObservable<T>(delta$: Observable<Delta<T>>): Observable<T[]> {
    return delta$.pipe(
        scan((acc, delta) => {
            if (delta.type === 'add') {
                return [...acc, delta.element];
            } else if(delta.type === 'remove') {
                return acc.filter(element => element !== delta.element);
            } else {
                throw new Error('invalid delta type: ' + delta.type);
            }
        }, [] as T[]),
        startWith([])
    );
}

export function filterRedundant<T>(observable: Observable<T[]>): Observable<T[]> {
    return reconstructDeltaObservable(
        mergeDifferenceObservables(
            observableArrayDifference(
                observable
            )
        )
    );
}
