import { useSearchParam } from './useSearchParam';

export function usePagination(limit = 10) {
  const [pageStr, setPageStr] = useSearchParam('page', '1');
  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const setPage = (p: number) => setPageStr(String(p));

  return { page, limit, setPage, offset: (page - 1) * limit };
}
