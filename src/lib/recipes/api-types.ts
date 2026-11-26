// Response shapes of /api/recipes routes the page and the routes share. Import-free.

/** One 🛒 sheet line: an ingredient, the product to buy, how much, and whether it starts ticked. */
export interface MatchLine {
  id: string;
  text: string;
  product: { key: string; name: string; img: string | null; w: boolean } | null;
  qty: number;
  ticked: boolean;
}

/** A product hit for linking a line when the caller has no calories permission (no nutrition). */
export interface ProductLite { key: string; name: string; img: string | null; w: boolean }
