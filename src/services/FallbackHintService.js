export class FallbackHintService {
  buildHint(data, generationResult) {
    const failedReason = data?.failedReason || 'Unknown';
    const quotaMessage = generationResult?.errorType === 'QUOTA_EXCEEDED'
      ? 'Dich vu AI dang vuot han muc tam thoi, he thong gui goi y co ban de ban tiep tuc lam bai.'
      : 'Dich vu AI tam thoi gian doan, he thong gui goi y co ban de ban tiep tuc lam bai.';

    const performanceHint = failedReason === 'FOLLOW_UP_REQUEST'
      ? '- Ban da yeu cau goi y bo sung: hay doi chieu y tuong hien tai voi rang buoc de bai va viet test nho de kiem chung tung buoc.\n- Neu van sai, thu doi cach mo hinh du lieu (prefix sum, hash map, two pointers, stack/queue) phu hop mau bai toan.'
      : failedReason === 'Time Limit Exceeded'
        ? '- Tap trung toi uu do phuc tap (uu tien O(n) hoac O(n log n) neu co the).\n- Kiem tra cac vong lap long nhau va thao tac du thua.'
        : '- Kiem tra lai cac truong hop bien (nho nhat, lon nhat, mang rong, gia tri am).\n- In test nho de doi chieu logic tung buoc voi de bai.';

    return [
      '### AI Hint (Fallback)',
      quotaMessage,
      '',
      `- Bai toan: ${data?.problemTitle || 'Khong ro ten bai'}`,
      `- Ket qua hien tai: ${failedReason}`,
      '',
      '#### Goi y thuc hanh',
      performanceHint,
      '- Tach bai toan thanh cac ham nho de debug de hon.',
      '- So sanh output cua ban voi expected output tren 2-3 test tu tao.',
      '',
      '> Luu y: Day la goi y dinh huong, khong phai loi giai hoan chinh.',
    ].join('\n');
  }
}
