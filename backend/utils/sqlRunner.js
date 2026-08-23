/**
 * sqlRunner — grades SQL questions without Judge0 (which only runs
 * compile-and-execute languages, not "query against a seeded schema").
 * Each submission gets a fresh in-memory SQLite database via sql.js
 * (pure WASM, no native build step — chosen specifically because this repo's
 * dev/deploy targets can't reliably compile native Node modules like
 * better-sqlite3). The database is created and destroyed per call; nothing
 * persists between submissions or leaks between students.
 *
 * Expected-output format: each test case's `expectedOutput` is the student
 * query's result set serialized as one row per line, comma-joined column
 * values — e.g. "1,Alice\n2,Bob". Sellers author hidden/sample test cases in
 * this same format (see seller Question Bank "Coding/SQL" form).
 */
import initSqlJs from 'sql.js';

let sqlJsPromise = null;
function getSqlJs() {
    if (!sqlJsPromise) sqlJsPromise = initSqlJs();
    return sqlJsPromise;
}

const serializeResult = (execResult) => {
    if (!execResult || execResult.length === 0) return '';
    const last = execResult[execResult.length - 1];
    return last.values.map(row => row.map(v => (v === null ? '' : String(v))).join(',')).join('\n');
};

const runOneCase = async (SQL, schema, query, testCase) => {
    const db = new SQL.Database();
    try {
        db.run(schema || '');
        if (testCase.input && testCase.input.trim()) db.run(testCase.input);

        let execResult;
        try {
            execResult = db.exec(query);
        } catch (err) {
            return { isHidden: !!testCase.isHidden, passed: false, stdout: '', stderr: err.message, executionTimeMs: 0, memoryKb: 0 };
        }

        const actual = serializeResult(execResult).trim();
        const expected = (testCase.expectedOutput || '').trim();
        return { isHidden: !!testCase.isHidden, passed: actual === expected, stdout: actual, stderr: '', executionTimeMs: 0, memoryKb: 0 };
    } finally {
        db.close();
    }
};

export async function runSqlSubmission({ schema, query, testCases }) {
    const SQL = await getSqlJs();
    const results = [];
    for (const tc of testCases) {
        results.push(await runOneCase(SQL, schema, query, tc));
    }
    return results;
}
