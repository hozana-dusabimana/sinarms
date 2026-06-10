import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Client-side pagination for in-memory lists (the backend list endpoints
// return full result sets, so slicing happens in the browser). The page is
// re-clamped on every render so a shrinking list — filters, deletions, live
// refreshes — can never strand the user on an empty page past the end.
export function usePagination(items, perPage) {
  const [page, setPage] = useState(0);
  const list = items || [];
  const pageCount = Math.max(1, Math.ceil(list.length / perPage));
  const pageSafe = Math.min(page, pageCount - 1);
  const pageItems = list.slice(pageSafe * perPage, pageSafe * perPage + perPage);
  return { page: pageSafe, pageCount, pageItems, setPage, total: list.length };
}

export default function Pagination({ page, pageCount, onPageChange, info, className = '' }) {
  if (pageCount <= 1 && !info) return null;

  return (
    <div
      className={`px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 ${className}`}
    >
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">{info}</span>
      {pageCount > 1 && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(0, page - 1))}
            disabled={page === 0}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs font-bold font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            {page + 1} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
            disabled={page >= pageCount - 1}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Next page"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
