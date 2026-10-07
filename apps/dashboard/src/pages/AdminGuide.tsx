import { Link } from "react-router";
import { Faq, FaqGroup } from "../components/Faq";

// The admin guide: everything needed to run the pools, in plain English. Static text.

export function AdminGuide() {
  return (
    <div className="mx-auto max-w-lg space-y-6 px-6 pb-6 pt-4">
      <div>
        <Link to="/admin/more" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-muted">
          More
        </Link>
        <h1 className="text-3xl font-semibold leading-tight text-brand-text">Admin guide</h1>
        <p className="mt-1 text-sm text-brand-muted">Everything you need to run the pools, in plain English.</p>
      </div>

      <FaqGroup title="Every week">
        <Faq q="Enter results as games finish" open>
          Open Results, then tap the winner of each game. Do it once and it counts in every pool this season. A tie has its own button. Or
          tap Check for results: it looks up the games that have finished on ESPN, shows them, and saves them only when you tap Apply. A
          result you entered by hand is never changed that way.
        </Faq>
        <Faq q='If you see "Needs your attention"'>
          That's a wipeout: a result would knock out everyone left in a pool. Nothing is applied until you choose who stays in. Open it
          from Next step.
        </Faq>
        <Faq q="Tell players what's on">
          Open More, then From the brewery. Feature a drink or dish, add a special, add live music or write an announcement. Players see
          them on Home.
        </Faq>
        <Faq q="Keep the menu current">
          Open Menu. Flip a beer off when it runs out, and add new drinks and dishes with Add. Prices are optional.
        </Faq>
      </FaqGroup>

      <FaqGroup title="Setting up">
        <Faq q="Create a pool">Open Pools, then New pool. Choose Survivor or Pick 'Em. You can't change the type afterwards.</Faq>
        <Faq q="When do picks lock?">
          In the pool's Settings, "When picks lock" is either "At each game's kickoff" (new pools start this way) or "At the week's first
          kickoff". With each game's kickoff, players can still pick later games after the first game has started. If the NFL moves a game,
          tap Check for results: it lists games whose time changed, and Apply updates them so the locks stay right.
        </Faq>

        <Faq q="Lock the rules">
          When the rules are right, switch Rules are locked on in the pool's Settings. Players can't be surprised by changes mid-season.
          You can unlock it again if you need to.
        </Faq>
        <Faq q="Add a player yourself">
          Open the pool's Players tab and tap Add. Enter their email. They don't need an account first.
        </Faq>
        <Faq q="Set the pool total">
          In the pool's Settings, type the amount into Pool total. The app only shows it. It never handles money.
        </Faq>
        <Faq q="Print the table card">
          Open More, then Table card, and tap Print. The code on it opens the menu, and invites people to play.
        </Faq>
      </FaqGroup>

      <FaqGroup title="If you are also playing">
        <Faq q="Why does my own entry need someone else?">
          If you keep your own entry alive in a wipeout, or change your own status, another admin has to confirm it first. Tap Ask another
          admin to confirm. Nothing changes until they do. If you are the only admin, it goes through and is recorded in Activity.
        </Faq>
      </FaqGroup>

      <FaqGroup title="If something goes wrong">
        <Faq q="I entered a wrong result">
          Open Results, tap Change next to the game and pick the right winner. In Survivor, anyone the wrong result already knocked out has
          to be put back by hand on the Players tab. Pick 'Em points fix themselves.
        </Faq>
        <Faq q="A player can't sign in">
          Ask them to request a new link on the sign-in page and open it on the same phone. Links only work once. If they set a password,
          they can sign in with that too.
        </Faq>
        <Faq q="The schedule is missing">
          The NFL schedule is loaded once a season by the developer. If a season shows no games, ask them to run the schedule importer.
        </Faq>
      </FaqGroup>
    </div>
  );
}
