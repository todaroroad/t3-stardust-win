import { Skeleton } from "../ui/skeleton";

export function UsageSkeleton() {
  return (
    <div data-usage-overview data-apple-dashboard data-usage-initial-loading aria-busy="true">
      <div className="usage-summary">
        <div className="usage-page-conclusion">
          <Skeleton className="h-[18px] w-64" />
          <div className="usage-mega">
            <Skeleton className="h-[52px] w-48" />
          </div>
          <div className="usage-conclusion-row h-7">
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div data-usage-card className="usage-kpis usage-ribbon">
          {[0, 1, 2, 3].map((i) => (
            <section className="usage-kpi" key={i}>
              <div className="usage-card-title">
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="usage-kpi-value">
                <Skeleton className="h-[34px] w-32" />
              </div>
            </section>
          ))}
        </div>
      </div>
      <h2 className="usage-section-title relative">
        {"\u00a0"}
        <span>{"\u00a0"}</span>
        <Skeleton className="absolute left-0 top-1 h-4 w-48" />
      </h2>
      <section data-usage-main-row>
        <div data-usage-card data-usage-chart-card>
          <div className="usage-card-title relative">
            {"\u00a0"}
            <Skeleton className="absolute left-0 top-1 h-4 w-32" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex gap-2">
              <div className="h-56 w-14 shrink-0" />
              <div className="usage-cost-plot min-w-0 flex-1">
                <div className="usage-readout">
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-56 w-full" />
              </div>
            </div>
            <div className="usage-axis-labels" />
          </div>
        </div>
        <div data-usage-card data-usage-provider-card>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-64 w-full" />
        </div>
      </section>
      <h2 className="usage-section-title relative">
        {"\u00a0"}
        <span>{"\u00a0"}</span>
        <Skeleton className="absolute left-0 top-1 h-4 w-48" />
      </h2>
      <section data-usage-bottom-row>
        <div data-usage-card className="min-h-[322px]">
          <Skeleton className="h-56 w-full" />
        </div>
        <div data-usage-card className="min-h-[322px]">
          <Skeleton className="h-56 w-full" />
        </div>
      </section>
    </div>
  );
}
