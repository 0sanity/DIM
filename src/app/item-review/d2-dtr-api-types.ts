import { DtrReviewer, DimWorkingUserReview, RatingData, DimUserReview } from "./dtr-api-types";
import { DestinyActivityModeType } from "bungie-api-ts/destiny2";

/** A "basic" item.
 * Used as the building block for submitting item reviews to the DTR API.
 */
export interface DtrD2BasicItem {
  /** Reference ID (item hash). */
  referenceId: number;
  /** Instance ID (vaguely personally identifying). */
  instanceId?: string;
  /** What mods does the user have attached? */
  attachedMods?: number[];
  /** What perks does the user have selected? */
  selectedPerks?: number[];
}

/** The form that votes come back to us in for items in D2. */
export interface DtrD2Vote extends D2ItemFetchRequest {
  /** How many upvotes were there? */
  upvotes: number;
  /** How many downvotes were there? */
  downvotes: number;
  /** How many total votes did this item have? */
  total: number;
  /** Upvotes - downvotes. We don't use this locally. */
  score: number;
}

/** The fetch request for a single item.
 * Expected to be sent as part of an array of requests in a bulk fetch.
 */
export interface D2ItemFetchRequest {
  /** Reference ID (hash ID). */
  referenceId: number;
}

/** The fetch response for a single item. */
export interface D2ItemFetchResponse extends D2ItemFetchRequest {
  /** The votes for a single item. */
  votes: DtrD2Vote;
}

/** If the user chooses to make any review moves on an item, they're stored here. */
export interface WorkingD2Rating extends DimWorkingUserReview {
  /** The vote. Can be...
   * -1 (thumbs down)
   * 0 (no vote)
   * 1 (thumbs up)
   */
  voted: number;
  /** Pros - reserved for future use. */
  pros: string;
  /** Cons - reserved for future use. */
  cons: string;
  /** Text of the review.
   * Optional.
   */
  text: string;
  /** What play mode was this review for?
   */
  mode: DtrD2ActivityModes;
}

/** A single user's review, contained in an item review response. */
export interface D2ItemUserReview extends DimUserReview {
  /** The DTR review ID. */
  id: string;
  /** Timestamp that DTR received the review. */
  timestamp: Date;
  /** Is the current DIM user the reviewer?
   * Note: this is currently broken, so we set this based off of the current platform.
   */
  isReviewer: boolean;
  /** Is this a review from a featured reviewer?
   * Not sure if this flag works either.
   */
  isHighlighted: boolean;
  /** The instance ID for the item reviewed. */
  instanceId?: string;
  /** Who made the review? */
  reviewer: DtrReviewer;
  /** What was their vote? Should be -1 or 1. */
  voted: number;
  /** Pros - not currently expected. */
  pros: string;
  /** Cons - not currently expected. */
  cons: string;
  /** Review text.
   * Optional to send, optional to receive.
   */
  text: string;
  /** What perks did the user have selected on this item? */
  selectedPerks: number[];
  /** What power mods did the user have attached to this item? */
  attachedMods: number[];
  /** What play mode is this for? */
  mode: DtrD2ActivityModes;
  /** Sandbox season (1 was the first, 2 is the March 2018 "go fast" update).
   * Not enumerating these values here because we're not using this and who wants to update this with a new sandbox?
   */
  sandbox: number;
}

/** A response from DTR for detailed reviews on a particular item. */
export interface D2ItemReviewResponse extends D2ItemFetchResponse {
  /** The total number of reviews. */
  totalReviews: number;
  /** Reviews for the item.
   * More particulars - they return a maximum of 25 text reviews per item, newest first, and we can page through them.
   * Don't tell anyone I haven't bothered building pagination out yet.
   */
  reviews: D2ItemUserReview[];
}

/** The subset of DestinyActivityModeType that we use for game modes. */
export enum DtrD2ActivityModes {
  notSpecified = DestinyActivityModeType.None,
  playerVersusEnemy = DestinyActivityModeType.AllPvE,
  playerVersusPlayer = DestinyActivityModeType.AllPvP,
  raid = DestinyActivityModeType.Raid,
  trials = DestinyActivityModeType.TrialsOfTheNine
}

/**Cached rating/review data.
 * Contains keys for lookups, response data from the API and user's local working review data (if they make any changes).
 */
export interface D2RatingData extends RatingData {
  /** Reference ID (hash ID). This is all we need to look up an item for D2 (currently). */
  referenceId: number;
  /** The bulk rating fetch response (if there was one). */
  fetchResponse?: D2ItemFetchResponse;
  /** The item reviews response (if there was one). */
  reviewsResponse?: D2ItemReviewResponse;
  /** The user's local review. */
  userReview: WorkingD2Rating;
}
