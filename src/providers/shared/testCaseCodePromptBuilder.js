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
  const categoriesText = formatCategories(request?.categories);

  const feedbackBlock = request?.feedback
    ? `\n<user_feedback>\nThe user has reviewed the previous code and requests the following changes:\n${trimText(request.feedback, 2000)}\n</user_feedback>\n`
    : '';

  const previousCodeBlock =
    request?.previousInputCode || request?.previousOutputCode
      ? `\n<previous_code>\n<previous_input_code>\n${trimText(request.previousInputCode, 6000) || '(none)'}\n</previous_input_code>\n\n<previous_output_code>\n${trimText(request.previousOutputCode, 6000) || '(none)'}\n</previous_output_code>\n</previous_code>\n`
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

<test_plan_categories>
${categoriesText}
</test_plan_categories>
${feedbackBlock}${previousCodeBlock}
OUTPUT — return ONLY a JSON object with two keys:
{
  "inputCode": "<full Python input generation script as a string>",
  "outputCode": "<full Python solution script as a string>"
}

RULES:
1. Both scripts must be complete, runnable Python 3 programs.
2. The input generation script should print to stdout in the exact format the problem expects.
3. The output/solution script should read from stdin and print the correct answer to stdout.
4. Use "import random" and "random.seed()" in the input generation script for reproducibility when needed.
5. The input script should respect ALL stated constraints (value ranges, array sizes, etc.).
6. Print a clear separated by exactly the string: ---TEST_BOUNDARY--- between each test case in the input generation script so individual tests can be easily distinguished.
7. Start your response with { and end with }. No Markdown fences, no extra text.
8. Escape newlines and special characters properly in the JSON string values.
${request?.feedback ? '9. Pay careful attention to the user_feedback section and adjust your code accordingly.' : ''}
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
  const categoriesText = formatCategories(request?.categories);

  let userContent = `Generate two Python scripts for the following problem.

Problem:
${statement}

Input constraints: ${inputConstraint || 'Not specified.'}
Output constraints: ${outputConstraint || 'Not specified.'}

Test plan categories:
${categoriesText}

Return a JSON object:
{
  "inputCode": "<full Python input generation script>",
  "outputCode": "<full Python solution script>"
}

The input script generates valid test input to stdout.
The output script reads stdin and prints the correct answer to stdout.
Print a clear separated by exactly the string: ---TEST_BOUNDARY--- between each test case in the input generation script so individual tests can be easily distinguished.
Start with { and end with }.`;

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
