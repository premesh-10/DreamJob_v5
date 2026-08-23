/**
 * judge0Client — thin wrapper around a Judge0 instance's submission API.
 * Uses Judge0's `wait=true` synchronous mode so one HTTP call returns a
 * finished result, instead of us having to poll Judge0's own token-based
 * async flow ourselves. Our own job queue (utils/jobQueue.js) is the layer
 * that decouples this from the caller's request thread — this client itself
 * stays simple.
 *
 * JUDGE0_API_URL / JUDGE0_AUTH_TOKEN are read at call time (not module load)
 * so tests/dev can run without them set as long as no coding question is
 * actually executed — see docker-compose.judge0.yml for self-hosting.
 */

const LANGUAGE_IDS = {
    python3: 71,
    javascript: 63,
    java: 62,
    cpp: 54,
    c: 50,
    csharp: 51,
    go: 60,
    ruby: 72,
    php: 68,
    typescript: 74
};

export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_IDS);

async function submitOne({ language, code, stdin }) {
    const apiUrl = process.env.JUDGE0_API_URL;
    if (!apiUrl) {
        throw new Error('Code execution service is not configured (set JUDGE0_API_URL) — see docker-compose.judge0.yml');
    }
    const languageId = LANGUAGE_IDS[language];
    if (!languageId) throw new Error(`Unsupported language: ${language}`);

    const headers = { 'Content-Type': 'application/json' };
    if (process.env.JUDGE0_AUTH_TOKEN) headers['X-Auth-Token'] = process.env.JUDGE0_AUTH_TOKEN;

    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/submissions?base64_encoded=false&wait=true`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ source_code: code, language_id: languageId, stdin: stdin || '' })
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Judge0 request failed (${res.status}): ${text.slice(0, 300)}`);
    }

    const data = await res.json();
    return {
        stdout: data.stdout || '',
        stderr: data.stderr || data.compile_output || '',
        statusDescription: data.status?.description || 'Unknown',
        executionTimeMs: data.time ? Math.round(parseFloat(data.time) * 1000) : 0,
        memoryKb: data.memory || 0
    };
}

// Runs `code` against every test case sequentially, returning per-case results
// in the same order. Hidden-case stdin/expectedOutput is consumed here only —
// callers must never persist a hidden case's raw input/expected text downstream.
export async function runJudge0Submission({ language, code, testCases }) {
    const results = [];
    for (const tc of testCases) {
        const r = await submitOne({ language, code, stdin: tc.input });
        const passed = r.statusDescription === 'Accepted' && r.stdout.trim() === (tc.expectedOutput || '').trim();
        results.push({
            isHidden: !!tc.isHidden,
            passed,
            stdout: r.stdout,
            stderr: r.stderr,
            statusDescription: r.statusDescription,
            executionTimeMs: r.executionTimeMs,
            memoryKb: r.memoryKb
        });
    }
    return results;
}
