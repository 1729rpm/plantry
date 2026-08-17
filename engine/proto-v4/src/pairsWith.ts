/**
 * `pairsWith` overlay (v4 spec plate rule 7).
 *
 * The spec makes `pairsWith` new dish frontmatter resolving to library dishes by exact
 * name. This prototype does not edit 266 files in `data/dishes/`, so the same data lives
 * here keyed by dish id, with the exact spec name kept alongside for traceability.
 *
 * Spec plate rule 7 initial data, verbatim:
 *
 *   fish tikka + kadhi; soya chunks masala + vegetable korma; toor dal and moong dal +
 *   a dry sabzi; chole + raita; palak paneer + missi roti; mutton keema + pav.
 *
 * Two of those six entries do not resolve to a library dish name:
 *
 *   - "a dry sabzi" is a CLASS, not a dish. It is carried here as a `categoryPartner`
 *     so the pairing is still exercised rather than silently dropped. This is a
 *     prototype extension to the spec's schema, recorded in run-notes.md.
 *   - Every other entry resolves by exact name against the live library.
 *
 * See run-notes.md for the four entries that resolve but cannot be PLACED under the v4
 * plate rules as written.
 */

export interface PairsWithEntry {
  /** The dish that names partners. */
  dishId: number;
  dishName: string;
  /** Partner dish ids, resolved from the spec's exact names. */
  partnerDishIds: number[];
  /**
   * Prototype extension: a partner expressed as a dish CATEGORY rather than a name
   * ("a dry sabzi"). Not part of the v4 schema as written; see run-notes.md.
   */
  categoryPartners?: string[];
  /** The spec's own wording, for traceability. */
  specText: string;
}

export const PAIRS_WITH: PairsWithEntry[] = [
  {
    dishId: 118,
    dishName: "Fish tikka",
    partnerDishIds: [8],
    specText: "fish tikka + kadhi",
  },
  {
    dishId: 76,
    dishName: "Soya chunks masala",
    partnerDishIds: [134],
    specText: "soya chunks masala + vegetable korma",
  },
  {
    dishId: 67,
    dishName: "Toor dal",
    partnerDishIds: [],
    categoryPartners: ["Dry dish"],
    specText: "toor dal and moong dal + a dry sabzi",
  },
  {
    dishId: 65,
    dishName: "Moong dal",
    partnerDishIds: [],
    categoryPartners: ["Dry dish"],
    specText: "toor dal and moong dal + a dry sabzi",
  },
  {
    dishId: 6,
    dishName: "Chole",
    partnerDishIds: [52],
    specText: "chole + raita",
  },
  {
    dishId: 3,
    dishName: "Palak paneer",
    partnerDishIds: [151],
    specText: "palak paneer + missi roti",
  },
  {
    dishId: 219,
    dishName: "Mutton keema",
    partnerDishIds: [281],
    specText: "mutton keema + pav",
  },
];

const BY_DISH_ID = new Map<number, PairsWithEntry>(PAIRS_WITH.map((e) => [e.dishId, e]));

/** The `pairsWith` entry a placed dish carries, if any. */
export function pairsWithFor(dishId: number): PairsWithEntry | undefined {
  return BY_DISH_ID.get(dishId);
}
