import { SiteLogo } from "@/components/SiteLogo";

export function RouteLoading() {
  return (
    <div className="scout-root">
      <div className="route-loading" role="status">
        <SiteLogo variant="wordmark" className="route-loading-mark" alt="" />
        <span className="route-loading-status">
          <i className="fa-solid fa-circle-notch" aria-hidden="true" />
          Carregando…
        </span>
      </div>
    </div>
  );
}
