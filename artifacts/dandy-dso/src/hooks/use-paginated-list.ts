import { useState, useMemo } from "react";

export type PageSize = 10 | 25 | 50 | 100;
const PAGE_SIZES: PageSize[] = [10, 25, 50, 100];

export function usePaginatedList<T>(
  items: T[],
  searchFn?: (item: T, query: string) => boolean,
  defaultPageSize: PageSize = 10
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(defaultPageSize);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim() || !searchFn) return items;
    const q = search.trim().toLowerCase();
    return items.filter((item) => searchFn(item, q));
  }, [items, search, searchFn]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paged = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize]
  );

  const handlePageSizeChange = (size: PageSize) => {
    setPageSize(size);
    setPage(1);
  };

  const handleSearchChange = (q: string) => {
    setSearch(q);
    setPage(1);
  };

  return {
    paged,
    filtered,
    page: safePage,
    setPage,
    pageSize,
    setPageSize: handlePageSizeChange,
    search,
    setSearch: handleSearchChange,
    totalPages,
    totalFiltered: filtered.length,
    PAGE_SIZES,
  };
}
