import * as _ from 'underscore';
import { Subject, ReplaySubject, ConnectableObservable } from '@reactivex/rxjs';
import { compareAccounts, DestinyAccount } from '../accounts/destiny-account.service';
import { IDictionaryComponent, IDestinyCharacterComponent, IDestinyCharacterProgressionComponent, IDestinyInventoryComponent, ISingleComponentResponse } from '../bungie-api/interfaces';

export interface ProgressService {
  getProgressStream: (account: DestinyAccount) => ConnectableObservable<ProgressProfile>,
  reloadProgress: () => void
}

/**
 * A slimmed down version of IDestinyProfileResponse for just what we get
 * TODO: Move all this into bungie-api.
 */
interface ProgressProfileResponse {
  characters: IDictionaryComponent<IDestinyCharacterComponent>;
  characterProgressions: IDictionaryComponent<IDestinyCharacterProgressionComponent>;
  profileInventory: ISingleComponentResponse<IDestinyInventoryComponent>;
  itemComponents: object;
}

// TODO: generate all the API structures from the Swagger docs
// This is a kind of radical approach - the result is not modified or interpreted until we get to components!
// Should allow for better understanding of updates, but prevents us from "correcting" and interpreting the data,
// and means we may have to block on defs lookup in the UI rendering :-/
export interface ProgressProfile {
  readonly defs;
  readonly profileInfo: ProgressProfileResponse;
  /**
   * The date the most recently played character was last played.
   */
  readonly lastPlayedDate: Date;
}

// TODO: use ngimport to break this free of Angular-ness
export function ProgressService(Destiny2Api, D2StoreFactory, D2Definitions, D2ManifestService, $q, loadingTracker) {
  'ngInject';

  // A subject that keeps track of the current account. Because it's a
  // behavior subject, any new subscriber will always see its last
  // value.
  const accountStream: Subject<DestinyAccount> = new ReplaySubject<DestinyAccount>(1);

  // The triggering observable for force-reloading progress.
  const forceReloadTrigger = new Subject();

  // A stream of progress that switches on account changes and supports reloading.
  // This is a ConnectableObservable that must be connected to start.
  const storesStream = accountStream
        // Only emit when the account changes
        .distinctUntilChanged(compareAccounts)
        // But also re-emit the current value of the account stream
        // whenever the force reload triggers
        .merge(forceReloadTrigger.switchMap(() => accountStream.take(1)))
        // Whenever either trigger happens, load progress
        .switchMap((account: DestinyAccount) => loadProgress(account))
        // Keep track of the last value for new subscribers
        .publishReplay(1);

  const service: ProgressService = {
    getProgressStream,
    reloadProgress
  };

  return service;

  /**
   * Set the current account, and get a stream of stores updates.
   * This will keep returning stores even if something else changes
   * the account by also calling "storesStream". This won't force the
   * stores to reload unless they haven't been loaded at all.
   *
   * @return {Observable} a stream of store updates
   */
  function getProgressStream(account: DestinyAccount) {
    accountStream.next(account);
    // Start the stream the first time it's asked for. Repeated calls
    // won't do anything.
    storesStream.connect();
    return storesStream;
  }

  /**
   * Force the inventory and characters to reload.
   * @return {Promise} the new stores
   */
  function reloadProgress() {
    forceReloadTrigger.next(); // signal the force reload
  }

  async function loadProgress(account: DestinyAccount): Promise<ProgressProfile> {
    // TODO: this would be nicer as async/await, but we need the scope-awareness of the Angular promise for now
    const reloadPromise = $q.all([Destiny2Api.getProgression(account), D2Definitions.getDefinitions()]).then(([profileInfo, defs]) => {;
      return {
        defs,
        profileInfo,
        get lastPlayedDate() {
          return _.reduce(_.values(this.profileInfo.characters.data), (memo, character) => {
            const d1 = new Date(character.dateLastPlayed);
            return (memo) ? ((d1 >= memo!) ? d1 : memo) : d1;
          }, new Date(0));
        }
      };
    })
    .finally(() => {
      D2ManifestService.isLoaded = true;
    });

    loadingTracker.addPromise(reloadPromise);

    return reloadPromise;
  }
}