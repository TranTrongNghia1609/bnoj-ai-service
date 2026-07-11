/**
 * Prompt builder for the Test Case Code generation feature.
 *
 * The AI returns TWO Python scripts in a single JSON response:
 *   - inputCode  : generates test input matching the plan's category constraints
 *   - outputCode : reads the generated input and produces the expected output (i.e. the solution)
 *
 * Returned JSON structure:
 * {
 *   "inputCode":  "<Python code string>",
 *   "outputCode": "<Python code string>"
 * }
 */

const trimText = (value, maxLen = 4000) => {
  const text = String(value || '');
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
};

const formatCategories = (categories) => {
  if (!Array.isArray(categories) || categories.length === 0) return 'No categories specified.';
  return categories
    .map((g) => `- ${g.category} (${g.count} tests): ${g.description || 'no description'}`)
    .join('\n');
};

// ---------------------------------------------------------------------------
// Raw text prompt (Gemini / single-turn providers)
// ---------------------------------------------------------------------------

/**
 * @param {Object} request
 * @param {string} request.statement
 * @param {string} request.inputConstraint
 * @param {string} request.outputConstraint
 * @param {string} [request.inputExample]
 * @param {string} [request.outputExample]
 * @param {Array}  request.categories
 * @param {string} [request.feedback]
 * @param {string} [request.previousInputCode]
 * @param {string} [request.previousOutputCode]
 * @returns {string}
 */
export const buildTestCaseCodePrompt = (request) => {
  const statement = trimText(request?.statement, 3000);
  const inputConstraint = trimText(request?.inputConstraint, 1000);
  const outputConstraint = trimText(request?.outputConstraint, 1000);
  const inputExample = trimText(request?.inputExample, 2000);
  const outputExample = trimText(request?.outputExample, 2000);
  const categoriesText = formatCategories(request?.categories);

  const feedbackBlock = request?.feedback
    ? `\n<user_feedback>\nThe user has reviewed the previous code and requests the following changes:\n${trimText(request.feedback, 2000)}\n</user_feedback>\n`
    : '';

  const previousCodeBlock =
    request?.previousInputCode || request?.previousOutputCode
      ? `\n<previous_code>\n<previous_input_code>\n${trimText(request.previousInputCode, 6000) || '(none)'}\n</previous_input_code>\n\n<previous_output_code>\n${trimText(request.previousOutputCode, 6000) || '(none)'}\n</previous_output_code>\n</previous_code>\n`
      : '';

  const sampleBlock = (inputExample || outputExample)
    ? `\n<sample_io>\n<input_data>\n${inputExample || '(not provided)'}\n</input_data>\n<output_data>\n${outputExample || '(not provided)'}\n</output_data>\n</sample_io>\n`
    : '';

  return `You are an expert competitive-programming problem setter and Python programmer.

Generate TWO Python scripts for the problem below:

1. **Input Generation Code** — a Python script that generates valid test input data.
   It should be runnable as a standalone script and output to stdout.
   It must generate input that matches the problem's input format and constraints.
   The script should use randomization (import random) to produce varied test cases
   according to the test plan categories described below.

2. **Output Generation Code** — a Python script that reads the generated input from stdin,
   solves the problem correctly, and outputs the expected answer to stdout.
   This is essentially a correct solution to the problem.

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
<test_plan_categories>
${categoriesText}
</test_plan_categories>
${feedbackBlock}
${previousCodeBlock}
OUTPUT — return ONLY a JSON object with two keys:
{
  "inputCode": "<full Python input generation script as a string>",
  "outputCode": "<full Python solution script as a string>"
}

RULES:
1. Both scripts must be complete, runnable Python 3 programs.
2. inputCode MUST produce stdout in EXACTLY the same format as the content inside <input_data> in <sample_io>. Match whitespace, newlines, and ordering precisely.
3. outputCode MUST read stdin and produce stdout in EXACTLY the same format as the content inside <output_data> in <sample_io>.
4. CRITICAL — inputCode MUST NOT print anything other than raw test case data and the separator ---TEST_BOUNDARY---. No labels, no headers, no comments, no debug lines. Every character printed by inputCode goes directly into the .in file.
5. CRITICAL — outputCode MUST NOT print anything other than the correct answer. No labels, no headers, no debug lines. Every character printed by outputCode goes directly into the .out file.
6. Before writing your final answer, mentally trace: run inputCode -> verify stdout format matches <input_data> -> feed that input to outputCode -> verify outputCode produces content matching <output_data>.
7. Use "import random" and "random.seed(42)" in inputCode for reproducibility.
8. inputCode must respect ALL stated constraints (value ranges, array sizes, data types).
9. Separate each test case block in inputCode by printing exactly ---TEST_BOUNDARY--- on its own line (and nothing else on that line).
10. Only use Python standard library modules (random, sys, math, itertools, collections, etc.). Do NOT import third-party packages.
11. Start your response with { and end with }. No Markdown fences, no extra text.
12. Escape newlines and special characters properly inside the JSON string values.
13. Don't generate example input/output
${request?.feedback ? '14. Pay careful attention to the user_feedback section and adjust your code accordingly.' : ''}
Generate the code now.`;
};

// ---------------------------------------------------------------------------
// OpenAI multi-turn chat messages
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert competitive-programming problem setter and Python programmer.
You generate two Python scripts: one for input generation and one for solving the problem (output generation).
Output ONLY a valid JSON object with keys "inputCode" and "outputCode".
Start with { and end with }. No Markdown, no prose.`;

/**
 * @param {Object} request
 * @returns {Array<{role: string, content: string}>}
 */
export const buildTestCaseCodeMessages = (request) => {
  const statement = trimText(request?.statement, 3000);
  const inputConstraint = trimText(request?.inputConstraint, 1000);
  const outputConstraint = trimText(request?.outputConstraint, 1000);
  const inputExample = trimText(request?.inputExample, 2000);
  const outputExample = trimText(request?.outputExample, 2000);
  const categoriesText = formatCategories(request?.categories);

  const sampleBlock = (inputExample || outputExample)
    ? `\n\nReference I/O (your code MUST produce output in this exact format):\n<input_data>\n${inputExample || '(not provided)'}\n</input_data>\n<output_data>\n${outputExample || '(not provided)'}\n</output_data>`
    : '';

  let userContent = `Generate two Python scripts for the following problem.

Problem:
${statement}

Input constraints: ${inputConstraint || 'Not specified.'}
Output constraints: ${outputConstraint || 'Not specified.'}${sampleBlock}

Test plan categories:
${categoriesText}

Return a JSON object:
{
  "inputCode": "<full Python input generation script>",
  "outputCode": "<full Python solution script>"
}

Rules:
- inputCode must print to stdout in EXACTLY the format shown inside <input_data> above. Match every character, space, and newline.
- outputCode must read from stdin and print EXACTLY the format shown inside <output_data> above.
- CRITICAL: inputCode MUST NOT print anything other than raw test case data and the ---TEST_BOUNDARY--- separator. No labels, no headers, no debug lines whatsoever — every character printed becomes part of the .in file.
- CRITICAL: outputCode MUST NOT print anything other than the correct answer — every character printed becomes part of the .out file.
- Before finalizing, mentally verify: inputCode output matches <input_data> format; feeding the <input_data> sample to outputCode produces the <output_data> sample.
- Only use Python standard library (random, sys, math, itertools, collections, etc.). No third-party packages.
- Use random.seed(42) in inputCode for reproducibility.
- Separate each test case in inputCode with exactly ---TEST_BOUNDARY--- on its own line (nothing else on that line).
- Don't generate example input/output in your code.
- Start with { and end with }.`;

  if (request?.feedback) {
    userContent += `\n\nUser feedback on previous code:\n${trimText(request.feedback, 2000)}`;
  }

  if (request?.previousInputCode || request?.previousOutputCode) {
    userContent += `\n\nPrevious input code:\n${trimText(request.previousInputCode, 6000) || '(none)'}`;
    userContent += `\n\nPrevious output code:\n${trimText(request.previousOutputCode, 6000) || '(none)'}`;
  }

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
};

// ---------------------------------------------------------------------------
// Input-only prompt (user-solution mode — Gemini / single-turn providers)
// ---------------------------------------------------------------------------

/**
 * When the user provides their own solution code, we only need AI to generate
 * the input generation script. This prompt omits all output/solution instructions.
 *
 * @param {Object} request
 * @returns {string}
 */
export const buildTestCaseInputOnlyPrompt = (request) => {
  const statement = trimText(request?.statement, 3000);
  const inputConstraint = trimText(request?.inputConstraint, 1000);
  const outputConstraint = trimText(request?.outputConstraint, 1000);
  const inputExample = trimText(request?.inputExample, 2000);
  const categoriesText = formatCategories(request?.categories);

  const feedbackBlock = request?.feedback
    ? `\n<user_feedback>\nThe user has reviewed the previous code and requests the following changes:\n${trimText(request.feedback, 2000)}\n</user_feedback>\n`
    : '';

  const previousCodeBlock = request?.previousInputCode
    ? `\n<previous_code>\n<previous_input_code>\n${trimText(request.previousInputCode, 6000)}\n</previous_input_code>\n</previous_code>\n`
    : '';

  const sampleInputBlock = inputExample
    ? `\n<sample_input>\n${inputExample}\n</sample_input>\n`
    : '';

  return `You are an expert competitive-programming problem setter and Python programmer.

Generate ONE Python script for the problem below:

**Input Generation Code** — a Python script that generates valid test input data.
It should be runnable as a standalone script and output to stdout.
It must generate input that matches the problem's input format and constraints.
The script should use randomization (import random) to produce varied test cases
according to the test plan categories described below.

NOTE: You do NOT need to generate a solution/output script. The user already has their own solution.
Only generate the input generation code.

<problem_statement>
${statement}
</problem_statement>

<input_constraints>
${inputConstraint || 'Not specified.'}
</input_constraints>

<output_constraints>
${outputConstraint || 'Not specified.'}
</output_constraints>
${sampleInputBlock}
<test_plan_categories>
${categoriesText}
</test_plan_categories>
${feedbackBlock}
${previousCodeBlock}
OUTPUT — return ONLY a JSON object with one key:
{
  "inputCode": "<full Python input generation script as a string>"
}

RULES:
1. The script must be a complete, runnable Python 3 program.
2. inputCode MUST produce stdout in EXACTLY the same format as the input described in the problem. Match whitespace, newlines, and ordering precisely.
3. CRITICAL — inputCode MUST NOT print anything other than raw test case data and the separator ---TEST_BOUNDARY---. No labels, no headers, no comments, no debug lines.
4. Use "import random" and "random.seed(42)" in inputCode for reproducibility.
5. inputCode must respect ALL stated constraints (value ranges, array sizes, data types).
6. Separate each test case block by printing exactly ---TEST_BOUNDARY--- on its own line.
7. Only use Python standard library modules. Do NOT import third-party packages.
8. Start your response with { and end with }. No Markdown fences, no extra text.
9. Escape newlines and special characters properly inside the JSON string values.
10. Don't generate example input/output.
${request?.feedback ? '11. Pay careful attention to the user_feedback section and adjust your code accordingly.' : ''}
Generate the code now.`;
};

// ---------------------------------------------------------------------------
// Input-only prompt (user-solution mode — OpenAI multi-turn chat messages)
// ---------------------------------------------------------------------------

const INPUT_ONLY_SYSTEM_PROMPT = `You are an expert competitive-programming problem setter and Python programmer.
You generate a Python script for input generation only. The user already has their own solution.
Output ONLY a valid JSON object with key "inputCode".
Start with { and end with }. No Markdown, no prose.`;

/**
 * @param {Object} request
 * @returns {Array<{role: string, content: string}>}
 */
export const buildTestCaseInputOnlyMessages = (request) => {
  const statement = trimText(request?.statement, 3000);
  const inputConstraint = trimText(request?.inputConstraint, 1000);
  const outputConstraint = trimText(request?.outputConstraint, 1000);
  const inputExample = trimText(request?.inputExample, 2000);
  const categoriesText = formatCategories(request?.categories);

  let userContent = `Generate a Python input generation script for the following problem.
The user already has their own solution — you only need to generate input test data.

Problem:
${statement}

Input constraints: ${inputConstraint || 'Not specified.'}
Output constraints: ${outputConstraint || 'Not specified.'}`;

  if (inputExample) {
    userContent += `\n\nReference input format (your code MUST produce input in this exact format):\n<input_data>\n${inputExample}\n</input_data>`;
  }

  userContent += `\n\nTest plan categories:\n${categoriesText}

Return a JSON object:
{
  "inputCode": "<full Python input generation script>"
}

Rules:
- inputCode must print to stdout in EXACTLY the format shown inside <input_data> above.
- CRITICAL: inputCode MUST NOT print anything other than raw test case data and the ---TEST_BOUNDARY--- separator.
- Only use Python standard library (random, sys, math, itertools, collections, etc.).
- Use random.seed(42) in inputCode for reproducibility.
- Separate each test case with exactly ---TEST_BOUNDARY--- on its own line.
- Don't generate example input/output.
- Start with { and end with }.`;

  if (request?.feedback) {
    userContent += `\n\nUser feedback on previous code:\n${trimText(request.feedback, 2000)}`;
  }

  if (request?.previousInputCode) {
    userContent += `\n\nPrevious input code:\n${trimText(request.previousInputCode, 6000)}`;
  }

  return [
    { role: 'system', content: INPUT_ONLY_SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
};
