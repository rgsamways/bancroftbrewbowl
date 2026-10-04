# Menu draft (from Robin's photos, 2026-10-04)

A draft to check, not entered anywhere. Nothing here is on the live site.

## Kitchen: "Menu" sheet (photo 1)

**Smokehouse Plates**
- 1/2 Rib, with 4 oz coleslaw: $18
- Full Rib, with 4 oz coleslaw: $30
- 1/4 Smoked Chicken, with 6 oz side and 4 oz coleslaw: $16
- Chicken & Ribs, two 1/4 chickens and 1/2 rack of ribs smoked to perfection, with a side of choice and coleslaw: $30

**Plates and sandwiches** (section name to confirm)
- Nachos: $18. Red onion, tomatoes, red bell peppers, jalapeños, sour cream and salsa. Add turkey +$7, add pulled pork +$7, add brisket +$9
- Smoked Brisket Sandwich: $25. Smoked brisket, horseradish mayo, pickled red onions, BBQ sauce on a brioche bun
- Cobb Salad: $23. Lettuce, red onions, cherry tomato, cucumber, egg, shredded cheese and turkey with ranch dressing
- Brew Master Trio: $30. Smoked turkey, smoked brisket, pulled pork and a piece of corn bread
- Cornbread: $6

**Upgrade your side, for $5:** potato salad, coleslaw, fennel salad, caesar salad, street corn, barbecue pork & beans

## Kitchen: numbered sheet (photo 2)

Looks like a second menu (a lunch or daily one?). **Is it a separate menu, or does it replace part of the first?**

1. Sweet & Smoky Pulled Pork: $18. Slow smoked pulled pork tossed in sweet and smoky BBQ sauce, topped with creamy coleslaw on a brioche bun. Served with spring salad
2. Smash Burger: $16. Fresh ground beef (4 oz patty) topped with pickles, diced onion and the house burger sauce. Served with spring salad. Add cheese +$2, add bacon +$3, add patty +$4
3. Freshly Smoked Turkey, with green goddess dressing: $20. Smoked turkey topped with cucumber, arugula and green goddess dressing on a toasted brioche bun. Served with spring salad. Add bacon +$3

Same side upgrade ($5, your choice of the six sides) and Corn Bread $6. "All meals come with a spring salad or you can upgrade your side."

## Drinks (from the closer photos, all readable)

**Beer pours (the same for every beer):** Brew Master's pint 20 oz $8.50, Brewer's choice 12 oz half pint $6.50, pitcher 64 oz $22. Flights $13.00 with a choice of 4 (extra taster $4 each). "Ask us about our seasonal draft options."

| Beer | ABV | IBU | Style |
| --- | --- | --- | --- |
| Sawmill Lager | 4.5% | 10 | Lager |
| Grasshopper Lager | 3.7% | 7 | Lager |
| Blonde Lady | 4.5% | 18 | German Blonde Ale |
| V-Rock | 5.8% | 14 | Vienna Ale |
| Prospectors Ale | 5.4% | 17 | English Pale Ale |
| White Pine Pilsner | 4.0% | 13 | Pilsner |
| Crooked Slide | 6.3% | 42 | Imperial Cream Ale |
| Rusty Husky | 5.6% | 25 | Amber Ale |
| Claim Jumper | 5.4% | 72 | American Pale Ale |
| Hawkwatch | 6.8% | 32 | New England India Pale Ale |
| Miners Pick | 5.2% | 28 | German Altbier |
| Loggers Ale | 5.6% | 28 | Brown Ale |
| Black Quartz | 6.0% | 33 | Dark English Ale |
| York River | 5.4% | 33 | Classic Stout |
| Highfalls ST | 5.4% | 33 | Creamy Chocolate Stout |
| Rocky Radler | 4.2% | N/A | Cranberry Radler |
| Twisted Timber | 5.0% | N/A | Hard Ice Tea |

(The sheet has a dotted line between Hawkwatch and Miners Pick; what does it mean? Lighter and darker beers?)
Also on tap: Cottage Springs Raspberry Lemonade $8.00 and Muskoka Spirits $8.00 (a canned vodka soda, per Robin's search; added).

**Liquor:** 1 oz $8.25, 2 oz $11.50 (vodka, gin, rum, rye, tequila). Cabot Trail Cream Liquor $8.00. Ultimate Brewkru Caesar $13.00. Add an extra skewer $2.50.

**Non-alcoholic:** pop $3.50 (Coke, Coke Zero, Sprite, ginger ale, tonic, soda water, iced tea). Apple, orange and cranberry juice $3.50 each. Kool-Aid Jammers $2.00. Non-alcoholic beer $6.50 (Blonde, Red, Bud 0). Coffee / tea $2.00.

**Wine (5 oz / 9 oz):**
- White: Jackson Triggs Sauvignon Blanc 8.75 / 11.50; Burnt Ship Bay Pinot Grigio 8.75 / 11.50; Peller Family Reserve Chardonnay 8.75 / 11.50; Pelee Island Pinot Grigio 9.50 / 12.50; Cottage Block Sauvignon Riesling 9.75 / 12.75; Santa Margherita Pinot Grigio 9.50 / 12.50
- Red: Jackson Triggs Cabernet Sauvignon 8.75 / 11.50; Peller Family Reserve Cabernet Merlot 9.00 / 12.00; Peller Family Pinot Noir 9.00 / 12.00; Pelee Island Pinot Noir 9.00 / 12.00; Burnt Ship Cabernet Merlot 9.00 / 12.00
- Moscato: Don't Poke the Bear 9.75 / 12.75
- Rose: Lola Rose 9.00 / 12.00

## How it would go in

- Kitchen items are `dish` items with a section each (Smokehouse Plates, and so on); add-ons and side choices go in the item's options. Beers are `beer` items with style, ABV and the on-tap section; wine and other drinks use the fixed Wine and Other drinks sections.
- Newer or seasonal beers can carry the New or Seasonal labels once you tell me which.
- Entry options: type them in through the admin Menu screens, or I write a one-off import script that reads this file (you'd run it, because of the permission guard). Either way you check the list first.
