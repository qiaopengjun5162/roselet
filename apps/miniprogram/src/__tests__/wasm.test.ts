jest.mock('@/utils/wasm', () => ({
  initWasm: jest.fn().mockResolvedValue(false),
  getRecommendation: jest.fn().mockReturnValue(null),
  getLayout: jest.fn().mockReturnValue(null),
  filterRoses: jest.fn().mockReturnValue(null),
  validatePlant: jest.fn().mockReturnValue(null),
  formatPlantRequest: jest.fn().mockReturnValue(null),
}));

import { getRecommendation } from '@/utils/wasm';

describe('getRecommendation', () => {
  it('returns null when WASM not initialized', () => {
    expect(getRecommendation([{ color: 'red' }])).toBeNull();
  });
});
