import { formatMenuPrice, styleLine, type MenuPage, type MenuRow } from "@bbb/shared";

function Row({ row }: { row: MenuRow }) {
  if (row.type === "heading") {
    return (
      <h3 className="flex h-[42px] items-end border-b border-brand-accent pb-1 text-[22px] font-semibold uppercase tracking-wide text-brand-accent">
        {row.name}
        {row.continued && <span className="ml-2 text-sm font-medium normal-case tracking-normal text-brand-muted">continued</span>}
      </h3>
    );
  }
  const { item } = row;
  const price = formatMenuPrice(item.priceCents);
  const details = styleLine(item);
  return (
    <div data-testid="tv-menu-item" className="flex h-[42px] items-center gap-3 border-b border-brand-border text-[24px]">
      <span className="min-w-0 truncate font-medium text-brand-text">{item.name}</span>
      {details && <span className="min-w-0 flex-1 truncate text-lg text-brand-muted">{details}</span>}
      {!details && <span className="flex-1" />}
      {price && <span className="flex-none font-semibold tabular-nums text-brand-text">{price}</span>}
    </div>
  );
}

/** One page of the Drinks or Kitchen slide: up to two columns of section headings and items. */
export function MenuSlide({ title, page, pageIndex, pageCount }: { title: string; page: MenuPage; pageIndex: number; pageCount: number }) {
  return (
    <div data-testid="tv-menu" data-title={title} className="flex h-full flex-col px-11 pb-6 pt-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[34px] font-semibold text-brand-text">{title}</h2>
        {pageCount > 1 && <span className="text-lg text-brand-muted">{pageIndex + 1} of {pageCount}</span>}
      </div>
      <div className="grid flex-1 grid-cols-2 gap-x-12">
        {page.columns.map((column, i) => (
          <div key={i} className="min-w-0">
            {column.map((row, r) => (
              <Row key={r} row={row} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
