// Placeholder Explore screen. The four-tab bar ships in slice 5.1, but the
// Explore feed (slice 7.1) is built later, so this stub gives the tab a calm
// empty state until then. The Changes tab is now live (slice 6.1,
// ChangesScreen).

export function ExploreScreen() {
  return (
    <div className="screen__scroll">
      <div className="screen__header">
        <h1 className="screen__title">Explore</h1>
        <div className="screen__subtitle">Dishes you have not cooked yet</div>
      </div>
      <div className="empty-state">
        <div className="empty-state__title">Coming soon</div>A ranked, familiar-but-new feed of
        dishes to try lands here.
      </div>
    </div>
  );
}
