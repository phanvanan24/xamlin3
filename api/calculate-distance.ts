import { calculateDistance } from '../server/services/openrouter';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { mode, a, b } = req.body || {};
  if (!mode || !a || !b) {
    return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ tham số khoảng cách (mode, a, b)' });
  }

  try {
    const result = await calculateDistance(mode, a, b);
    return res.status(200).json(result);
  } catch (error: any) {
    const message = error?.message || 'Internal Server Error';
    if (message.includes('429') || message.includes('rate')) {
      return res.status(429).json({ error: 'AI đang bị giới hạn số lượng request. Vui lòng đợi 30-60 giây rồi thử lại.' });
    }
    return res.status(500).json({ error: 'Không thể tính khoảng cách lúc này. Vui lòng thử lại sau.', details: message });
  }
}