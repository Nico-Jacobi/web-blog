// Standalone test for merge logic in fileserver.js /write
// Run: node scripts/test-merge.js
// Keep in sync with the merge functions in fileserver.js.

function _ts(v) {
    if (!v) return -Infinity;
    const n = Date.parse(v);
    return Number.isNaN(n) ? -Infinity : n;
}

function mergeById(serverArr, clientArr, keyFn) {
    const by = new Map();
    for (const item of serverArr) by.set(keyFn(item), item);
    for (const item of clientArr) {
        const k = keyFn(item);
        const existing = by.get(k);
        if (!existing) { by.set(k, item); continue; }
        by.set(k, _ts(item.updatedAt) > _ts(existing.updatedAt) ? item : existing);
    }
    return Array.from(by.values());
}

const mergePoints = (s, c) => mergeById(s, c, p => p.id);
const _tripKey = t => t.id ?? (t.pointId1 * 1000000 + t.pointId2);
const mergeTrips  = (s, c) => mergeById(s, c, _tripKey);

let pass = 0, fail = 0;
function t(name, actual, expected) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) { pass++; console.log(`  ✓ ${name}`); }
    else { fail++; console.log(`  ✗ ${name}\n    got: ${a}\n    exp: ${e}`); }
}

const T1 = '2026-01-01T00:00:00Z';
const T2 = '2026-02-01T00:00:00Z';
const T3 = '2026-03-01T00:00:00Z';

console.log('mergePoints:');

t('server-only item survives when client does not include it',
    mergePoints([{id:1,name:'A'}], []),
    [{id:1,name:'A'}]);

t('client-only item gets added',
    mergePoints([], [{id:2,name:'B'}]),
    [{id:2,name:'B'}]);

t('newer client wins over older server',
    mergePoints(
        [{id:1,name:'old',updatedAt:T1}],
        [{id:1,name:'new',updatedAt:T2}]),
    [{id:1,name:'new',updatedAt:T2}]);

t('newer server wins over older client',
    mergePoints(
        [{id:1,name:'server-new',updatedAt:T3}],
        [{id:1,name:'client-old',updatedAt:T1}]),
    [{id:1,name:'server-new',updatedAt:T3}]);

t('tombstone with newer updatedAt wins',
    mergePoints(
        [{id:1,name:'alive',updatedAt:T1}],
        [{id:1,name:'alive',updatedAt:T2,deletedAt:T2}]),
    [{id:1,name:'alive',updatedAt:T2,deletedAt:T2}]);

t('resurrection with newer updatedAt wins over tombstone',
    mergePoints(
        [{id:1,name:'dead',updatedAt:T1,deletedAt:T1}],
        [{id:1,name:'resurrected',updatedAt:T2}]),
    [{id:1,name:'resurrected',updatedAt:T2}]);

t('null updatedAt loses to any timestamp',
    mergePoints(
        [{id:1,name:'legacy'}],
        [{id:1,name:'touched',updatedAt:T1}]),
    [{id:1,name:'touched',updatedAt:T1}]);

t('two nulls: server wins (conservative)',
    mergePoints(
        [{id:1,name:'server'}],
        [{id:1,name:'client'}]),
    [{id:1,name:'server'}]);

t('multi-client scenario: A changes #2, B adds #4; both survive',
    (() => {
        let server = [{id:1},{id:2,name:'orig'},{id:3}];
        // App A modifies #2
        server = mergePoints(server, [{id:1},{id:2,name:'by-A',updatedAt:T1},{id:3}]);
        // App B (still has orig #2, no timestamps) adds #4
        server = mergePoints(server, [{id:1},{id:2,name:'orig'},{id:3},{id:4,name:'new',updatedAt:T2}]);
        return server;
    })(),
    [{id:1},{id:2,name:'by-A',updatedAt:T1},{id:3},{id:4,name:'new',updatedAt:T2}]);

console.log('\nmergeTrips:');

t('trips merge by id — same id, newer method wins',
    mergeTrips(
        [{id:1,pointId1:1,pointId2:2,method:'car',updatedAt:T1}],
        [{id:1,pointId1:1,pointId2:2,method:'boat',updatedAt:T2},
         {id:2,pointId1:2,pointId2:3,method:'foot',updatedAt:T1}]),
    [{id:1,pointId1:1,pointId2:2,method:'boat',updatedAt:T2},
     {id:2,pointId1:2,pointId2:3,method:'foot',updatedAt:T1}]);

t('reorder: mutating pointId1 on same trip id does NOT create an orphan',
    (() => {
        // Server has trip id=1: A(1) → B(2)
        // Client inserts waypoint W(3) between, so trip id=1 becomes W → B, and a new trip id=2 is A → W
        let server = [{id:1,pointId1:1,pointId2:2,method:'car',updatedAt:T1}];
        const clientAfterReorder = [
            {id:1,pointId1:3,pointId2:2,method:'car',updatedAt:T2}, // mutated
            {id:2,pointId1:1,pointId2:3,method:'car',updatedAt:T2}, // new
        ];
        return mergeTrips(server, clientAfterReorder);
    })(),
    [{id:1,pointId1:3,pointId2:2,method:'car',updatedAt:T2},
     {id:2,pointId1:1,pointId2:3,method:'car',updatedAt:T2}]);

t('legacy trip without id gets synthetic id from composite — stable across devices',
    mergeTrips(
        [{pointId1:5,pointId2:6,method:'car'}],                  // server: legacy
        [{pointId1:5,pointId2:6,method:'boat',updatedAt:T1}]),  // client: same pair, no id
    // client wins because updatedAt > null. Both sides synthesized the same key.
    [{pointId1:5,pointId2:6,method:'boat',updatedAt:T1}]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
