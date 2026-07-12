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
    locale: request?.locale || request?.responseLanguage || request?.userLanguage || "vi",
  };
};

const getHintLanguageInstruction = (request) => {
  if (request?.locale && typeof request.locale === 'string') {
    const loc = request.locale.toLowerCase();
    if (loc.includes('vi')) {
      return '\nYÊU CẦU QUAN TRỌNG VỀ NGÔN NGỮ: Bạn PHẢI trả lời và giải thích gợi ý (hint) 100% bằng tiếng Việt tự nhiên, rõ ràng.\n';
    }
    if (loc.includes('en')) {
      return '\nCRITICAL LANGUAGE REQUIREMENT: You MUST answer and provide all explanations in clear English.\n';
    }
    return `\nCRITICAL LANGUAGE REQUIREMENT: You MUST answer and provide all explanations strictly in the language specified by locale="${request.locale}".\n`;
  }
  return '\nYÊU CẦU QUAN TRỌNG VỀ NGÔN NGỮ / CRITICAL LANGUAGE REQUIREMENT:\nBạn PHẢI tự động nhận diện ngôn ngữ tự nhiên của đề bài (<thong_tin_bai_toan>) hoặc câu hỏi của người dùng, và trả lời gợi ý (hint) hoàn toàn bằng NGÔN NGỮ ĐÓ. Nếu đề bài hoặc câu hỏi bằng tiếng Việt, trả lời 100% bằng tiếng Việt rõ ràng, dễ hiểu. Nếu đề bài hoặc câu hỏi bằng tiếng Anh, trả lời 100% bằng tiếng Anh. KHÔNG trả lời bằng tiếng Anh nếu đề bài đang bằng tiếng Việt.\n';
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

  return `Bạn là một AI Mentor chuyên nghiệp và tận tâm, chuyên hỗ trợ người dùng giải quyết các bài tập lập trình.
Nhiệm vụ của bạn là phân tích code, hướng dẫn người dùng tìm ra lỗi sai và tự cải thiện, TUYỆT ĐỐI KHÔNG viết thay mã nguồn hoàn chỉnh cho họ.

${failedContext ? `**TÌNH TRẠNG HIỆN TẠI:**\n${failedContext}\n` : ''}

<thong_tin_bai_toan>
- Tên bài: ${problemTitle}
- Ngôn ngữ lập trình: ${language}
- Đề bài: ${statement}
- Định dạng Input: ${inputSpec}
- Định dạng Output: ${outputSpec}
- Ví dụ (Test cases):
${examplesText}
</thong_tin_bai_toan>

<lich_su_hoi_thoai>
${conversationText || 'Chưa có hội thoại trước đó.'}
</lich_su_hoi_thoai>

<code_cua_nguoi_dung>
\`\`\`${language}
${sourceCode}
\`\`\`
</code_cua_nguoi_dung>

<cau_hoi_tu_nguoi_dung>
${followUpQuestion || 'Không có câu hỏi bổ sung. Hãy dựa vào mã nguồn và tình trạng hiện tại để chủ động đưa ra gợi ý.'}
</cau_hoi_tu_nguoi_dung>

**YÊU CẦU TRẢ LỜI CỦA BẠN (RẤT QUAN TRỌNG):**
1. **Phân tích nguyên nhân:** Chỉ ra sơ hở trong logic hoặc lỗi cú pháp (dựa trên failed context hoặc code của người dùng), giúp họ hiểu TẠI SAO code sai hoặc chưa tối ưu.
2. **Sử dụng phương pháp gợi mở (Socratic):** Đặt câu hỏi để người dùng tự suy nghĩ bước tiếp theo, hướng dẫn họ từng bước thay vì nói thẳng đáp án.
3. **Mức độ gợi ý:** Nếu trong <lich_su_hoi_thoai> đã có gợi ý, hãy đi sâu hơn một bước so với lần trước.
4. **Định dạng:** Trình bày rõ ràng, thân thiện. Sử dụng Markdown để highlight từ khóa, tên biến, hoặc hàm.
5. **RÀNG BUỘC TỐI THƯỢNG:** TUYỆT ĐỐI KHÔNG cung cấp đoạn code hoàn chỉnh để giải quyết bài toán. Bạn chỉ được phép cung cấp mã giả (pseudocode) ngắn, hoặc sửa tối đa 1-2 dòng nếu thật sự cần thiết để giải thích về mặt cú pháp.
6. ĐỘ DÀI: Câu trả lời phải cực kỳ ngắn gọn, súc tích, tối đa không quá 3-4 câu hoặc 1 đoạn văn.
${getHintLanguageInstruction(request)}`;
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
5. Tra ve goi y bang Markdown theo dung ngon ngu duoc yeu cau.
${getHintLanguageInstruction(request)}
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

  messages.push({ role: 'user', content: `${userTurn}\n${getHintLanguageInstruction(request)}` });

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
5. Trả về gợi ý bằng Markdown theo đúng ngôn ngữ được yêu cầu.
${getHintLanguageInstruction(request)}`;

  return [
    { role: 'system', content: SYSTEM_PROMPT_REFINER },
    { role: 'user', content: problemContext },
    { role: 'user', content: refineRequest },
  ];
};

// Alias for backward compatibility
export const buildGeminiPrompt = (request) => buildDraftPrompt(request);
