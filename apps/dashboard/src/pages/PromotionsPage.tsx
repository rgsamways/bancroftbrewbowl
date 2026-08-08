const IDEAS = [
  "Survivor Sunday specials — a discount for anyone still alive in a pool who checks in at the bar on game day.",
  "Elimination consolation — a one-time drink/food discount for entries the moment they're eliminated, to soften the blow and keep them coming back.",
  "Milestone rewards — survive to week 5 / 10 / 15 and unlock a small reward redeemable in-house.",
  "Referral bonus — bring a friend who joins the pool, you both get a discount.",
  "Standings on the big screen — show live pool standings on a TV during game days to get people talking.",
  "Hot-team special — a themed food/drink special tied to whichever team the most entries picked that week.",
];

export function PromotionsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-6 pb-6">
      <p className="text-sm text-brand-muted">
        Coming soon — this is where you'll set up weekly promotions tied to the pools, to bring people
        into the bar. For now, here are a few ideas to consider:
      </p>
      <ul className="list-disc space-y-2 rounded border border-brand-border bg-brand-surface p-4 pl-8 text-sm text-brand-text">
        {IDEAS.map((idea) => (
          <li key={idea}>{idea}</li>
        ))}
      </ul>
    </div>
  );
}
