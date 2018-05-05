import { ItemTransformer } from './itemTransformer';
import * as _ from 'underscore';
import { D1Item } from '../inventory/item-types';
import { D1CachedItem, D1ItemFetchResponse, WorkingD1Rating, D1ItemReviewResponse } from '../item-review/d1-dtr-api-types';

/**
 * Cache of review data.
 * Mixes and matches remote as well as local data to cut down on chatter and prevent data loss on store refreshes.
 */
export class ReviewDataCache {
  _itemStores: D1CachedItem[];
  _itemTransformer: ItemTransformer;

  constructor() {
    this._itemTransformer = new ItemTransformer();
    this._itemStores = [];
  }

  _getMatchingItem(item: D1Item): D1CachedItem | undefined {
    const dtrItem = this._itemTransformer.translateToDtrWeapon(item);

    // The DTR API isn't consistent about returning reference ID as an int in its responses
    // and findWhere considers 123 !== "123".
    dtrItem.referenceId = String(dtrItem.referenceId);

    return _.find(this._itemStores, { referenceId: dtrItem.referenceId, roll: dtrItem.roll });
  }

  /**
   * Get the locally-cached review data for the given item from the DIM store, if it exists.
   */
  getRatingData(item: D1Item): D1CachedItem | undefined {
    return this._getMatchingItem(item);
  }

  _toAtMostOneDecimal(rating: number): number {
    if ((rating % 1) === 0) {
      return rating;
    }

    return Number(rating.toFixed(1));
  }

  /**
   * Add (and track) the community score.
   */
  addScore(dtrRating: D1ItemFetchResponse) {
    if (dtrRating && dtrRating.rating) {  // not sure if we were sometimes receiving empty ratings or what
      dtrRating.rating = this._toAtMostOneDecimal(dtrRating.rating);
    }

    const cachedItem: D1CachedItem = {
      referenceId: dtrRating.referenceId,
      fetchResponse: dtrRating,
      lastUpdated: new Date(),
      dimScore: (dtrRating.rating) ? dtrRating.rating : 0
    };

    this._itemStores.push(cachedItem);
  }

  /**
   * Keep track of this user review for this (DIM store) item.
   * This supports the workflow where a user types a review but doesn't submit it, a store refresh
   * happens in the background, then they go back to the item.  Or they post data and the DTR API
   * is still feeding back cached data or processing it or whatever.
   * The expectation is that this will be building on top of reviews data that's already been supplied.
   */
  addUserReviewData(item: D1Item,
                    userReview: WorkingD1Rating) {
    const cachedItem = this._getMatchingItem(item);

    if (!cachedItem) {
      return;
    }

    cachedItem.userReview = userReview;
  }

  /**
   * Keep track of expanded item review data from the DTR API for this DIM store item.
   * The expectation is that this will be building on top of community score data that's already been supplied.
   */
  addReviewsData(item: D1Item,
                 reviewsData: D1ItemReviewResponse) {
    const cachedItem = this._getMatchingItem(item);

    if (cachedItem) {
      cachedItem.reviewsResponse = reviewsData;
    }
  }

  /**
   * Fetch the collection of review data that we've stored locally.
   */
  getItemStores(): any[] {
    return this._itemStores;
  }

  markReviewAsIgnored(writtenReview) {
    writtenReview.isIgnored = true;
  }

  markItemAsReviewedAndSubmitted(
    item: D1Item
  ) {
    const cachedItem = this._getMatchingItem(item);

    if ((!cachedItem) || (!cachedItem.userReview)) {
      return;
    }

    cachedItem.userReview.treatAsSubmitted = true;

    if (!cachedItem.reviewsResponse) {
      return;
    }

    cachedItem.reviewsResponse.reviews = (cachedItem.reviewsResponse.reviews) ?
       cachedItem.reviewsResponse.reviews.filter((review) => !review.isReviewer) :
       [];
  }

  /**
   * There's a 10 minute delay between posting an item review to the DTR API
   * and being able to fetch that review from it.
   * To prevent angry bug reports, we'll continue to hang on to local user review data for
   * 10 minutes, then we'll purge it (so that it can be re-pulled).
   *
   * Item is just an item from DIM's stores.
   */
  eventuallyPurgeCachedData(item: D1Item) {
    const tenMinutes = 1000 * 60 * 10;

    setTimeout(() => {
      const cachedItem = this._getMatchingItem(item);

      if (cachedItem) {
        cachedItem.reviewsResponse = undefined;
        cachedItem.userReview = undefined;
      }
    },
      tenMinutes);
  }
}
