import { Link } from "react-router";
import { Faq, FaqGroup } from "../components/Faq";

// How to play: short answers to the usual questions. Static text.

export function Help() {
  return (
    <div className="mx-auto max-w-lg space-y-6 px-6 pb-6 pt-4">
      <div>
        <Link to="/account" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-muted">
          Back to Me
        </Link>
        <h1 className="text-3xl font-semibold leading-tight text-brand-text">How to play</h1>
        <p className="mt-1 text-sm text-brand-muted">Short answers to the usual questions.</p>
      </div>

      <FaqGroup title="The two games">
        <Faq q="Survivor" open>
          Pick one team to win each week. You can only use each team once all season. If your team loses or ties, you're out. The last player
          standing wins.
        </Faq>
        <Faq q="Pick 'em" open>
          Pick the winner of every game, every week. Each correct pick earns a point, and you can't be knocked out. The most points at the end
          wins.
        </Faq>
      </FaqGroup>

      <FaqGroup title="Picking">
        <Faq q="When do picks lock?">
          In most pools each pick locks when its own game kicks off, so a Sunday or Monday team stays open after Thursday's game starts. In
          a pool that locks by the week, everything locks when the first game of the week kicks off. Until a pick locks you can change it as
          often as you like. The Pick screen shows which kind of pool you're in and when the next game locks.
        </Faq>
        <Faq q="How do I change a pick?">
          Open the Pick tab, then tap a different team. In Survivor you'll tap Lock in to confirm.
        </Faq>
        <Faq q="When do results show up?">
          The brewery adds results as games finish, so there can be a short wait. Standings update straight after.
        </Faq>
      </FaqGroup>

      <FaqGroup title="Your account">
        <Faq q="Who can play?">You must be 19 or older to play.</Faq>
        <Faq q="How do I sign in?">
          Enter your email and we'll send you a link. Open it on your phone and you're in. If you'd like, you can also set a password on the
          Me page and use that instead.
        </Faq>
        <Faq q="Can I change my name or email?">
          Yes. Tap your initials at the top right to open Me. Your name is what other players see.
        </Faq>
      </FaqGroup>

      <p className="text-xs text-brand-faint">Please drink responsibly.</p>
    </div>
  );
}
