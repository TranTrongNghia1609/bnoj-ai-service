/**
 * Shared prompt builder.
 *
 * - buildDraftPrompt / buildRefinerPrompt  → raw text strings (used by Gemini).
 * - buildDraftMessages / buildRefinerMessages → OpenAI chat messages array.
 */

const trimText = (value, maxLen = 4000) => {
  const text = String(value || '');
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
};

const buildRequestContext = (request) => {
  const {
    sourceCode,
    problemTitle,
    problemStatement,
    problemInput,
    problemOutput,
    examplesInput,
    examplesOutput,
    failedReason,
    language,
    userQuestion,
    conversationContext,
  } = request;

  const statement = trimText(problemStatement, 3000);
  const inputSpec = trimText(problemInput, 800);
  const outputSpec = trimText(problemOutput, 800);
  const examplesIn = Array.isArray(examplesInput) ? examplesInput : [];
  const examplesOut = Array.isArray(examplesOutput) ? examplesOutput : [];

  const mergedExamples = examplesIn.map((input, index) => ({
    input: trimText(input, 500),
    output: trimText(examplesOut[index] || '', 500),
  }));

  const examplesText = mergedExamples.length > 0
    ? mergedExamples
        .slice(0, 2)
        .map((ex, idx) => `Vi du ${idx + 1}:\n- Input: ${ex.input}\n- Output: ${ex.output}`)
        .join('\n\n')
    : 'Khong co vi du.';

  const followUpQuestion = trimText(userQuestion, 500);
  const normalizedConversation = Array.isArray(conversationContext)
    ? conversationContext.slice(-4)
    : [];

  const conversationText = normalizedConversation.length > 0
    ? normalizedConversation
        .map((msg, idx) => {
          const role = String(msg?.role || 'unknown').toUpperCase();
          const content = trimText(msg?.content, 600);
          return `${idx + 1}. [${role}] ${content}`;
        })
        .join('\n')
    : 'Chua co hoi thoai truoc do.';

  const failedContext = failedReason === 'FOLLOW_UP_REQUEST'
    ? 'Nguoi dung dang xin them goi y bo sung dua tren code hien tai.'
    : `Nguoi dung vua nop bai va nhan ket qua: ${failedReason}.`;

  const trimmedSourceCode = trimText(sourceCode, 3000);

  return {
    sourceCode: trimmedSourceCode,
    language,
    problemTitle,
    statement,
    inputSpec,
    outputSpec,
    examplesText,
    failedContext,
    followUpQuestion,
    conversationText,
  };
};

// ---------------------------------------------------------------------------
// Raw text prompts (Gemini / single-turn providers)
// ---------------------------------------------------------------------------

export const buildDraftPrompt = (request) => {
  const {
    sourceCode,
    language,
    problemTitle,
    statement,
    inputSpec,
    outputSpec,
    examplesText,
    failedContext,
    followUpQuestion,
    conversationText,
  } = buildRequestContext(request);

  return `Bạn là người hổ trợ tận tâm. ${failedContext}

Ngon ngu bai lam: ${language}
Bai toan: "${problemTitle}".

Thong tin de bai:
- De bai: ${statement}
- Input: ${inputSpec}
- Output: ${outputSpec}
- Vi du:
${examplesText}

Hoi thoai gan day:
${conversationText}

Cau hoi bo sung tu hoc sinh:
${followUpQuestion || 'Khong co cau hoi bo sung cu the.'}

Yeu cau:
1. Phan tich de hoc sinh tu nhan ra van de.
2. Dua ra GOI Y bang tieng Viet theo dinh dang Markdown.
3. Tuyet doi KHONG dua loi giai code hoan chinh.
4. Neu da co goi y truoc do, dua huong tiep theo nang cao hon mot buoc.

Doan code cua hoc sinh:
\`\`\`${language}
${sourceCode}
\`\`\`
`;
};

export const buildRefinerPrompt = (request, draftHint) => {
  const {
    sourceCode,
    language,
    problemTitle,
    statement,
    inputSpec,
    outputSpec,
    examplesText,
    failedContext,
    followUpQuestion,
  } = buildRequestContext(request);

  const normalizedDraft = trimText(draftHint, 5000) || 'Khong co ban nhap hop le.';

  return `Ban la chuyen gia review va nang cap goi y lap trinh. Nhiem vu cua ban la cai tien goi y nhap ben duoi thanh ban huong dan ro rang, gon gang va huu ich hon.

${failedContext}

Thong tin bai toan:
- Bai toan: "${problemTitle}"
- De bai: ${statement}
- Input: ${inputSpec}
- Output: ${outputSpec}
- Vi du:
${examplesText}

Cau hoi bo sung tu hoc sinh:
${followUpQuestion || 'Khong co cau hoi bo sung cu the.'}

Doan code hien tai cua hoc sinh:
\`\`\`${language}
${sourceCode}
\`\`\`

Ban goi y nhap can cai tien:
\`\`\`markdown
${normalizedDraft}
\`\`\`

Yeu cau cai tien:
1. Giữ nguyên tinh thần cải tiến, không đưa ra lời giải code hoàn chỉnh.
2. Tăng độ rõ ràng: chia nhỏ các bước hành động cụ thể, để học sinh có thể tự làm tiếp.
3. Loai bo noi dung trung lap, manh de, hoac qua chung chung.
4. Neu can, them mot checklist ngan de hoc sinh tu kiem tra.
5. Tra ve bang tieng Viet va dung Markdown de de doc.

Chi tra ve noi dung goi y da cai tien, khong giai thich them ve qua trinh cai tien.`;
};

// ---------------------------------------------------------------------------
// OpenAI multi-turn chat messages
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT_DRAFT = `Bạn là trợ lý lập trình tận tâm hỗ trợ học sinh giải bài lập trình thi đấu.
Nhiệm vụ của bạn là đưa ra GỢI Ý ĐỊNH HƯỚNG bằng tiếng Việt theo định dạng Markdown.
Tuyệt đối KHÔNG đưa lời giải code hoàn chỉnh.
Luôn khuyến khích học sinh tự suy nghĩ và kiểm tra từng bước.`;

const SYSTEM_PROMPT_REFINER = `Bạn là chuyên gia review và nâng cấp gợi ý lập trình.
Nhiệm vụ của bạn là cải thiện một gợi ý nhập để trở nên rõ ràng, gọn gàng và hữu ích hơn.
Chỉ trả về nội dung gợi ý đã cải tiến, không giải thích thêm về quá trình cải tiến.
Tuyệt đối KHÔNG đưa lời giải code hoàn chỉnh.`;

/**
 * Build the messages array for an OpenAI draft-stage call.
 * Replays the last few conversation turns so the model has context.
 *
 * @param {Object} request  – normalized request from RequestHandler
 * @returns {Array<{role: string, content: string}>}
 */
export const buildDraftMessages = (request) => {
  const {
    sourceCode,
    language,
    problemTitle,
    statement,
    inputSpec,
    outputSpec,
    examplesText,
    failedContext,
    followUpQuestion,
    conversationText: _conversationText, // we'll replay turns individually below
  } = buildRequestContext(request);

  const normalizedConversation = Array.isArray(request?.conversationContext)
    ? request.conversationContext.slice(-4)
    : [];

  const problemContext = `${failedContext}

Ngôn ngữ bài làm: ${language}
Bài toán: "${problemTitle}"

Thông tin đề bài:
- Đề bài: ${statement}
- Input: ${inputSpec}
- Output: ${outputSpec}
- Ví dụ:
${examplesText}

Đoạn code hiện tại của học sinh:
\`\`\`${language}
${sourceCode}
\`\`\``;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT_DRAFT },
    { role: 'user', content: problemContext },
  ];

  // Replay previous conversation turns (assistant → user pairs)
  for (const msg of normalizedConversation) {
    const role = String(msg?.role || '').toLowerCase();
    const content = trimText(msg?.content, 600);
    if (role === 'assistant' || role === 'user') {
      messages.push({ role, content });
    }
  }

  // Current follow-up question (or first request)
  const userTurn = followUpQuestion
    ? followUpQuestion
    : 'Hãy phân tích và đưa ra gợi ý để tôi tự giải bài này.';

  messages.push({ role: 'user', content: userTurn });

  return messages;
};

/**
 * Build the messages array for an OpenAI refiner-stage call.
 *
 * @param {Object} request   – normalized request
 * @param {string} draftHint – draft hint from previous stage
 * @returns {Array<{role: string, content: string}>}
 */
export const buildRefinerMessages = (request, draftHint) => {
  const {
    sourceCode,
    language,
    problemTitle,
    statement,
    inputSpec,
    outputSpec,
    examplesText,
    failedContext,
    followUpQuestion,
  } = buildRequestContext(request);

  const normalizedDraft = trimText(draftHint, 5000) || 'Không có bản nhập hợp lệ.';

  const problemContext = `${failedContext}

Thông tin bài toán:
- Bài toán: "${problemTitle}"
- Đề bài: ${statement}
- Input: ${inputSpec}
- Output: ${outputSpec}
- Ví dụ:
${examplesText}

Câu hỏi bổ sung từ học sinh:
${followUpQuestion || 'Không có câu hỏi bổ sung cụ thể.'}

Đoạn code hiện tại của học sinh:
\`\`\`${language}
${sourceCode}
\`\`\``;

  const refineRequest = `Bản gợi ý nhập cần cải tiến:
\`\`\`markdown
${normalizedDraft}
\`\`\`

Yêu cầu cải tiến:
1. Giữ nguyên tinh thần cải tiến, không đưa ra lời giải code hoàn chỉnh.
2. Tăng độ rõ ràng: chia nhỏ các bước hành động cụ thể.
3. Loại bỏ nội dung trùng lặp, mạnh đề, hoặc quá chung chung.
4. Nếu cần, thêm một checklist ngắn để học sinh tự kiểm tra.
5. Trả về bằng tiếng Việt và dùng Markdown.`;

  return [
    { role: 'system', content: SYSTEM_PROMPT_REFINER },
    { role: 'user', content: problemContext },
    { role: 'user', content: refineRequest },
  ];
};

// Alias for backward compatibility
export const buildGeminiPrompt = (request) => buildDraftPrompt(request);
