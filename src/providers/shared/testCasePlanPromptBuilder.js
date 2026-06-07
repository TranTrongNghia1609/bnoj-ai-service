/**
 * Prompt builder for the Test Case Plan generation feature.
 *
 * The AI returns a GROUPED PLAN — an array of category groups.
 * Each group specifies: the category, how many tests belong to it,
 * and a description of what those tests should cover overall.
 *
 * No individual test case details, no input/output values.
 *
 * Returned JSON structure:
 * [
 *   {
 *     "category": "normal" | "edge" | "boundary" | "stress",
 *     "count": <int>,
 *     "description": "<what the tests in this group should cover>"
 *   }
 * ]
 * The sum of all "count" values must equal numberOfTestCases.
 */

const trimText = (value, maxLen = 4000) => {
  const text = String(value || '');
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
};

// ---------------------------------------------------------------------------
// Raw text prompt (Gemini / single-turn providers)
// ---------------------------------------------------------------------------

/**
 * @param {{ statement: string, inputConstraint: string, outputConstraint: string, numberOfTestCases: number, inputExample: string, outputExample: string }} request
 * @returns {string}
 */
export const buildTestCasePlanPrompt = (request) => {
  const statement = trimText(request?.statement, 3000);
  const inputConstraint = trimText(request?.inputConstraint, 1000);
  const outputConstraint = trimText(request?.outputConstraint, 1000);
  const inputExample = trimText(request?.inputExample, 2000);
  const outputExample = trimText(request?.outputExample, 2000);
  const n = Math.max(1, Math.min(50, Number(request?.numberOfTestCases) || 5));

  // Vẫn giữ sample để AI hiểu context bài toán, nhưng không bắt ép description phải map với nó theo kiểu format.
  const sampleBlock = (inputExample || outputExample)
      ? `\n<sample_io>\n=== Sample Input ===\n${inputExample || '(not provided)'}\n\n=== Sample Output ===\n${outputExample || '(not provided)'}\n</sample_io>\n`
      : '';

  return `You are an expert competitive-programming test designer.
Create a TEST CASE PLAN for the problem below.

The plan groups test cases by category. For each category, specify:
- how many test cases belong to it
- what scenarios those tests should collectively cover

Total test cases to plan: ${n}
You decide the distribution. It does NOT need to be equal across categories.

<problem_statement>
${statement}
</problem_statement>

<input_constraints>
${inputConstraint || 'Not specified.'}
</input_constraints>

<output_constraints>
${outputConstraint || 'Not specified.'}
</output_constraints>
${sampleBlock}
CATEGORIES:
- "normal"   : typical representative inputs a correct solution must handle
- "edge"     : unusual but valid inputs (single element, all equal, all negative, empty-like, etc.)
- "boundary" : values exactly at the stated constraint limits (min/max sizes or values)
- "stress"   : large-scale worst-case inputs to expose time/memory limit issues

OUTPUT — return ONLY a JSON array. Each element is a category group:
[
  {
    "category": "<normal | edge | boundary | stress>",
    "count": <number of test cases for this category>,
    "description": "<2-4 sentences describing the logic and data characteristics of these tests>"
  }
]

RULES:
1. Use between 1 and 4 category groups (only include categories that are relevant).
2. The sum of all "count" values must equal exactly ${n}.
3. Do NOT include individual test case details, input values, or expected outputs.
4. Start your response with [ and end with ]. No Markdown fences, no extra text.
5. CONCEPTUAL DESCRIPTIONS ONLY: Focus strictly on algorithmic scenarios (e.g., array sorted/unsorted, negative numbers, max N). NEVER mention text formatting, layout, or include phrases like "=== Sample Input ===", "=== Sample Output ===", or "đúng định dạng" in your descriptions.

Generate the test case plan now (total: ${n} tests).`;
};

// ---------------------------------------------------------------------------
// OpenAI multi-turn chat messages
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert competitive-programming test designer.
You produce TEST CASE PLANS — grouped by category, specifying count and a conceptual description for each group.
Focus on data characteristics (size, values, edge cases). NEVER mention standard I/O formatting or tags like "Sample Input".
No individual test case details. No input/output values.
Output ONLY a valid JSON array. Start with [ and end with ]. No Markdown, no prose.`;

/**
 * @param {{ statement: string, inputConstraint: string, outputConstraint: string, numberOfTestCases: number, inputExample: string, outputExample: string }} request
 * @returns {Array<{role: string, content: string}>}
 */
export const buildTestCasePlanMessages = (request) => {
  const statement = trimText(request?.statement, 3000);
  const inputConstraint = trimText(request?.inputConstraint, 1000);
  const outputConstraint = trimText(request?.outputConstraint, 1000);
  const inputExample = trimText(request?.inputExample, 2000);
  const outputExample = trimText(request?.outputExample, 2000);
  const n = Math.max(1, Math.min(50, Number(request?.numberOfTestCases) || 5));

  const sampleBlock = (inputExample || outputExample)
      ? `\nSample I/O:\n=== Sample Input ===\n${inputExample || '(not provided)'}\n=== Sample Output ===\n${outputExample || '(not provided)'}\n`
      : '';

  const userContent = `Create a test case plan for the following problem. Total: ${n} tests.
Group by category. You decide the count per category (must sum to ${n}).

Problem:
${statement}

Input constraints: ${inputConstraint || 'Not specified.'}
Output constraints: ${outputConstraint || 'Not specified.'}${sampleBlock}
Return a JSON array where each element has:
  "category": "normal" | "edge" | "boundary" | "stress"
  "count": <int>
  "description": "<what these tests cover logically (data characteristics). NEVER mention I/O formatting, layouts, or phrases like '=== Sample Input ==='>"

No individual test details. No input/output values.
Start with [ and end with ].`;

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
};