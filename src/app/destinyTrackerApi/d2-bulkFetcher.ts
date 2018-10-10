import { D2ReviewDataCache } from './d2-reviewDataCache';
import {
  DestinyVendorSaleItemComponent,
  DestinyVendorItemDefinition
} from 'bungie-api-ts/destiny2';
import { loadingTracker } from '../ngimport-more';
import { handleD2Errors } from './d2-trackerErrorHandler';
import { D2Store } from '../inventory/store-types';
import { dtrFetch } from './dtr-service-helper';
import { D2ItemFetchResponse, D2ItemFetchRequest } from '../item-review/d2-dtr-api-types';
import { getVendorItemList, getItemList } from './d2-itemListBuilder';

class D2BulkFetcher {
  _reviewDataCache: D2ReviewDataCache;

  constructor(reviewDataCache) {
    this._reviewDataCache = reviewDataCache;
  }

  _getBulkFetchPromise(
    stores: D2Store[],
    platformSelection: number,
    mode: number
  ): Promise<D2ItemFetchResponse[][]> {
    if (!stores.length) {
      return Promise.resolve<D2ItemFetchResponse[][]>([]);
    }

    const itemList = getItemList(stores, this._reviewDataCache);
    return this._getBulkItems(itemList, platformSelection, mode);
  }

  _getVendorBulkFetchPromise(
    platformSelection: number,
    mode: number,
    vendorSaleItems?: DestinyVendorSaleItemComponent[],
    vendorItems?: DestinyVendorItemDefinition[]
  ): Promise<D2ItemFetchResponse[][]> {
    if ((vendorSaleItems && !vendorSaleItems.length) || (vendorItems && !vendorItems.length)) {
      return Promise.resolve<D2ItemFetchResponse[][]>([]);
    }

    const vendorDtrItems = getVendorItemList(this._reviewDataCache, vendorSaleItems, vendorItems);
    return this._getBulkItems(vendorDtrItems, platformSelection, mode);
  }

  _getBulkItems(
    itemList: D2ItemFetchRequest[],
    platformSelection: number,
    mode: number
  ): Promise<D2ItemFetchResponse[][]> {
    if (!itemList.length) {
      return Promise.resolve<D2ItemFetchResponse[][]>([]);
    }

    const size = 10;
    const arrayOfArrays: D2ItemFetchRequest[][] = [];
    for (let i = 0; i < itemList.length; i += size) {
      arrayOfArrays.push(itemList.slice(i, i + size));
    }

    const arrayOfPromises: Promise<D2ItemFetchResponse[]>[] = [];

    for (const arraySlice of arrayOfArrays) {
      arrayOfPromises.push(
        dtrFetch(
          `https://db-api.destinytracker.com/api/external/reviews/fetch?platform=${platformSelection}&mode=${mode}`,
          arraySlice
        ).then(handleD2Errors, handleD2Errors)
      );
    }

    const promise4All = Promise.all<D2ItemFetchResponse[]>(arrayOfPromises);

    loadingTracker.addPromise(promise4All);

    return promise4All;
  }

  /**
   * Fetch the DTR community scores for all weapon items found in the supplied stores.
   */
  bulkFetch(stores: D2Store[], platformSelection: number, mode: number) {
    this._getBulkFetchPromise(stores, platformSelection, mode).then((bulkRankings) =>
      bulkRankings.forEach((br) => this.attachRankings(br, stores))
    );
  }

  _addScores(bulkRankings: D2ItemFetchResponse[]): void {
    this._reviewDataCache.addScores(bulkRankings);
  }

  getCache(): D2ReviewDataCache {
    return this._reviewDataCache;
  }

  /**
   * Fetch the DTR community scores for all weapon items found in the supplied vendors.
   */
  bulkFetchVendorItems(
    platformSelection: number,
    mode: number,
    vendorSaleItems?: DestinyVendorSaleItemComponent[],
    vendorItems?: DestinyVendorItemDefinition[]
  ): Promise<void> {
    return this._getVendorBulkFetchPromise(
      platformSelection,
      mode,
      vendorSaleItems,
      vendorItems
    ).then((bulkRankings) => bulkRankings.forEach((br) => this._addScores(br)));
  }

  attachRankings(bulkRankings: D2ItemFetchResponse[] | null, stores: D2Store[]): void {
    if (!bulkRankings && !stores) {
      return;
    }

    if (bulkRankings) {
      this._addScores(bulkRankings);
    }

    stores.forEach((store) => {
      store.items.forEach((storeItem) => {
        if (storeItem.reviewable) {
          const ratingData = this._reviewDataCache.getRatingData(storeItem);

          storeItem.dtrRating = ratingData;
        }
      });
    });
  }
}

export { D2BulkFetcher };
