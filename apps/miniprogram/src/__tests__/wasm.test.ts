import { getRecommendation } from '@/utils/wasm';

describe('getRecommendation', () => {
  it('returns null when WASM not initialized', () => {
    const result = getRecommendation([{ color: 'red' }]);
    expect(result).toBeNull();
  });
});
