import { useState, useMemo } from 'react';

export type RoseColor = 'all' | 'red' | 'white' | 'yellow';

export const FILTER_OPTIONS: { value: RoseColor; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'red', label: '红' },
  { value: 'white', label: '白' },
  { value: 'yellow', label: '黄' },
];

interface Filterable { color: string }

export function useGardenFilter<T extends Filterable>(items: T[]) {
  const [filter, setFilter] = useState<RoseColor>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter(item => item.color === filter);
  }, [items, filter]);

  return { filter, setFilter, filtered, options: FILTER_OPTIONS };
}
