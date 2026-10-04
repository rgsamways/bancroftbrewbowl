import "dotenv/config";
import { and, eq, sql } from "drizzle-orm";
import { createMenuItemSchema, DRINK_SECTIONS, type CreateMenuItemInput } from "@bbb/shared";
import { db } from "../src/db/client.js";
import { menuItems } from "../src/db/schema.js";

// One-off import of the brewery's printed menu (transcribed from photos, 2026-10-04).
// Usage: pnpm seed-menu            (dry run: checks every item and lists what it would add)
//        pnpm seed-menu --apply    (adds the items that are not already there)
// Safe to re-run: an item with the same kind, section and name is skipped, never changed.
// Items are added in the order below, which is the order the menu shows. This is an operator
// script, so it does not write Activity records (the admin Menu screens do).

const apply = process.argv.includes("--apply");

const cents = (dollars: number) => Math.round(dollars * 100);
const option = (name: string, price?: number) => ({ name, priceCents: price === undefined ? null : cents(price) });

const PLATES = "Smokehouse plates";
const SANDWICHES = "Sandwiches";
const MORE = "Nachos and salads";
const SIDES = "Sides";

const POURS = (ibu: string) => `IBU ${ibu}. 20 oz $8.50, 12 oz $6.50, pitcher $22.`;
const beer = (name: string, abv: string, ibu: string, style: string, seasonal = false): CreateMenuItemInput =>
  createMenuItemSchema.parse({ kind: "beer", name, style, abv: `${abv}%`, description: POURS(ibu), labels: seasonal ? ["seasonal"] : [] });

const dish = (section: string, name: string, price: number, description: string, options: ReturnType<typeof option>[] = []) =>
  createMenuItemSchema.parse({ kind: "dish", section, name, priceCents: cents(price), description, options });

const wine = (name: string, style: string, five: number, nine: number) =>
  createMenuItemSchema.parse({ kind: "wine", name, style, priceCents: cents(five), description: `5 oz $${five.toFixed(2)}, 9 oz $${nine.toFixed(2)}` });

const drink = (name: string, price: number, description?: string, options: ReturnType<typeof option>[] = []) =>
  createMenuItemSchema.parse({ kind: "drink", name, priceCents: cents(price), description, options });

const SIX_SIDES = ["Potato salad", "Coleslaw", "Fennel salad", "Caesar salad", "Street corn", "Barbecue pork & beans"];

const items: CreateMenuItemInput[] = [
  // Kitchen
  dish(PLATES, "1/2 Rib", 18, "With 4 oz coleslaw."),
  dish(PLATES, "Full Rib", 30, "With 4 oz coleslaw."),
  dish(PLATES, "1/4 Smoked Chicken", 16, "With a 6 oz side and 4 oz coleslaw."),
  dish(PLATES, "Chicken & Ribs", 30, "Two 1/4 chickens and 1/2 rack of ribs smoked to perfection, with a side of choice and coleslaw."),
  dish(PLATES, "Brew Master Trio", 30, "Smoked turkey, smoked brisket, pulled pork and a piece of corn bread."),
  dish(SANDWICHES, "Sweet & Smoky Pulled Pork", 18, "Slow smoked pulled pork tossed in our sweet and smoky BBQ sauce, topped with creamy coleslaw on a brioche bun. Served with spring salad."),
  dish(SANDWICHES, "Smash Burger", 16, "Fresh ground beef (4 oz patty) topped with pickles, diced onion and our own in-house burger sauce. Served with spring salad.", [
    option("Add cheese", 2),
    option("Add bacon", 3),
    option("Add patty", 4),
  ]),
  dish(SANDWICHES, "Freshly Smoked Turkey", 20, "Freshly smoked turkey topped with cucumber, arugula and our green goddess dressing, on a toasted brioche bun. Served with spring salad.", [option("Add bacon", 3)]),
  dish(SANDWICHES, "Smoked Brisket Sandwich", 25, "Smoked brisket, horseradish mayo, pickled red onions and BBQ sauce on a brioche bun."),
  dish(MORE, "Nachos", 18, "Red onion, tomatoes, red bell peppers, jalapeños, sour cream and salsa.", [option("Add turkey", 7), option("Add pulled pork", 7), option("Add brisket", 9)]),
  dish(MORE, "Cobb Salad", 23, "Lettuce, red onions, cherry tomato, cucumber, egg, shredded cheese and turkey with ranch dressing."),
  dish(SIDES, "Upgrade your side", 5, "All meals come with a spring salad, or upgrade it to your choice of these.", SIX_SIDES.map((s) => option(s))),
  dish(SIDES, "Cornbread", 6, ""),

  // Beer: year-round first, then the seasonal ones (below the dotted line on the printed sheet)
  beer("Sawmill Lager", "4.5", "10", "Lager"),
  beer("Grasshopper Lager", "3.7", "7", "Lager"),
  beer("Blonde Lady", "4.5", "18", "German Blonde Ale"),
  beer("V-Rock", "5.8", "14", "Vienna Ale"),
  beer("Prospectors Ale", "5.4", "17", "English Pale Ale"),
  beer("White Pine Pilsner", "4.0", "13", "Pilsner"),
  beer("Crooked Slide", "6.3", "42", "Imperial Cream Ale"),
  beer("Rusty Husky", "5.6", "25", "Amber Ale"),
  beer("Claim Jumper", "5.4", "72", "American Pale Ale"),
  beer("Hawkwatch", "6.8", "32", "New England India Pale Ale"),
  beer("Miners Pick", "5.2", "28", "German Altbier", true),
  beer("Loggers Ale", "5.6", "28", "Brown Ale", true),
  beer("Black Quartz", "6.0", "33", "Dark English Ale", true),
  beer("York River", "5.4", "33", "Classic Stout", true),
  beer("Highfalls ST", "5.4", "33", "Creamy Chocolate Stout", true),
  beer("Rocky Radler", "4.2", "N/A", "Cranberry Radler", true),
  beer("Twisted Timber", "5.0", "N/A", "Hard Ice Tea", true),

  // Wine (price is the 5 oz glass; the 9 oz price is in the description)
  wine("Jackson Triggs Sauvignon Blanc", "White", 8.75, 11.5),
  wine("Burnt Ship Bay Pinot Grigio", "White", 8.75, 11.5),
  wine("Peller Family Reserve Chardonnay", "White", 8.75, 11.5),
  wine("Pelee Island Pinot Grigio", "White", 9.5, 12.5),
  wine("Cottage Block Sauvignon Riesling", "White", 9.75, 12.75),
  wine("Santa Margherita Pinot Grigio", "White", 9.5, 12.5),
  wine("Jackson Triggs Cabernet Sauvignon", "Red", 8.75, 11.5),
  wine("Peller Family Reserve Cabernet Merlot", "Red", 9, 12),
  wine("Peller Family Pinot Noir", "Red", 9, 12),
  wine("Pelee Island Pinot Noir", "Red", 9, 12),
  wine("Burnt Ship Cabernet Merlot", "Red", 9, 12),
  wine("Don't Poke the Bear", "Moscato", 9.75, 12.75),
  wine("Lola Rose", "Rosé", 9, 12),

  // Other drinks
  drink("House liquor", 8.25, "Vodka, gin, rum, rye or tequila. 1 oz $8.25, 2 oz $11.50."),
  drink("Cabot Trail Cream Liquor", 8),
  drink("Ultimate Brewkru Caesar", 13, undefined, [option("Extra skewer", 2.5)]),
  drink("Cottage Springs Raspberry Lemonade", 8),
  drink("Pop", 3.5, "Coke, Coke Zero, Sprite, ginger ale, tonic, soda water or iced tea."),
  drink("Juice", 3.5, undefined, [option("Apple"), option("Orange"), option("Cranberry")]),
  drink("Kool-Aid Jammers", 2),
  drink("Non-alcoholic beer", 6.5, undefined, [option("Blonde"), option("Red"), option("Bud 0")]),
  drink("Coffee / tea", 2),
];

const sectionOf = (item: CreateMenuItemInput) => (item.kind === "dish" ? item.section! : DRINK_SECTIONS[item.kind]);

console.log(apply ? "Adding to the menu..." : "Dry run (nothing is written). Add --apply to write.");
let added = 0;
let skipped = 0;
for (const item of items) {
  const section = sectionOf(item);
  const [existing] = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(and(eq(menuItems.kind, item.kind), eq(menuItems.section, section), eq(menuItems.name, item.name)));
  if (existing) {
    skipped++;
    console.log(`  skip   ${item.kind.padEnd(5)} ${section} / ${item.name} (already there)`);
    continue;
  }
  added++;
  const price = item.priceCents === null ? "" : ` $${(item.priceCents / 100).toFixed(2)}`;
  console.log(`  ${apply ? "add " : "would add"} ${item.kind.padEnd(5)} ${section} / ${item.name}${price}`);
  if (!apply) continue;
  const [{ next }] = await db.select({ next: sql<number>`coalesce(max(${menuItems.sortOrder}), 0)::int + 1` }).from(menuItems);
  await db.insert(menuItems).values({
    kind: item.kind,
    section,
    name: item.name,
    style: item.style,
    abv: item.abv,
    description: item.description,
    priceCents: item.priceCents,
    options: item.options ?? [],
    labels: item.labels,
    sortOrder: next!,
  });
}
console.log(`${apply ? "Added" : "Would add"} ${added}, skipped ${skipped}.`);
process.exit(0);
