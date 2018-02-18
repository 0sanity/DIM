import { Subject } from 'rxjs/Subject';
import * as _ from 'underscore';
import { compareAccounts, DestinyAccount, getDestinyAccountsForBungieAccount } from '../accounts/destiny-account.service';
import { dimState } from '../state';
import { ConnectableObservable } from 'rxjs/observable/ConnectableObservable';
import { getBungieAccounts } from './bungie-account.service';
import { IPromise, IQService, IRootScopeService } from 'angular';
import { Observable } from 'rxjs/Observable';
import { SyncService } from '../storage/sync.service';

export interface PlatformServiceType {
  getPlatforms(): IPromise<DestinyAccount[]>;
  getActive(): DestinyAccount | null;
  setActive(account: DestinyAccount): void;
  getPlatformMatching(params: Partial<DestinyAccount>): DestinyAccount | undefined;
  getActiveAccountStream(): Observable<DestinyAccount>;
}

// TODO: push "current account" into the other account services
export function PlatformService($rootScope: IRootScopeService, $q: IQService, dimSettingsService): PlatformServiceType {
  'ngInject';
  let _platforms: DestinyAccount[] = [];
  let _active: DestinyAccount | null = null;

  // Set the active platform here - it'll drive the other observable
  const activePlatform$ = new Subject<DestinyAccount>();

  const current$: ConnectableObservable<DestinyAccount> = activePlatform$
    .distinctUntilChanged(compareAccounts)
    .do(saveActivePlatform)
    .publishReplay(1);

  const service = {
    getPlatforms,
    getActive,
    setActive,
    getPlatformMatching,
    getActiveAccountStream
  };

  return service;

  function getPlatformMatching(params: Partial<DestinyAccount>): DestinyAccount | undefined {
    return _.find(_platforms, params);
  }

  // TODO: return a list of bungie accounts and associated destiny accounts?
  function getPlatforms(): IPromise<DestinyAccount[]> {
    if (_platforms.length) {
      return $q.resolve(_platforms);
    }

    // TODO: wire this up with observables?
    return getBungieAccounts()
      .then((bungieAccounts) => {
        if (!bungieAccounts.length) {
          // We're not logged in, don't bother
          $rootScope.$broadcast('dim-no-token-found');
          return [];
        }

        // We only support one account now
        const membershipId = bungieAccounts[0].membershipId;
        return getDestinyAccountsForBungieAccount(membershipId);
      })
      .then((destinyAccounts: DestinyAccount[]) => {
        _platforms = destinyAccounts;
        return getActivePlatform();
      })
      .then(setActive)
      .then(() => _platforms);
  }

  async function getActivePlatform(): Promise<DestinyAccount | null> {
    if (_active) {
      return _active;
    }

    if (!_platforms.length) {
      return null;
    }

    const data = await SyncService.get();

    if (_active) {
      return _active;
    } else if (data && data.platformType) {
      let active = _platforms.find((platform) => {
        return platform.platformType === data.platformType && platform.destinyVersion === data.destinyVersion;
      });
      if (active) {
        return active;
      }
      active = _platforms.find((platform) => platform.platformType === data.platformType);
      if (active) {
        return active;
      }
    }
    return _platforms[0];
  }

  function getActive(): DestinyAccount | null {
    return _active;
  }

  function getActiveAccountStream() {
    current$.connect();
    return current$;
  }

  function saveActivePlatform(account: DestinyAccount): Promise<void> {
    // TODO: kill platform label
    _active = account;
    dimState.active = account;
    if (account === null) {
      return SyncService.remove('platformType');
    } else {
      if (dimSettingsService.destinyVersion !== account.destinyVersion) {
        dimSettingsService.destinyVersion = account.destinyVersion;
        dimSettingsService.save();
      }
      return SyncService.set({ platformType: account.platformType, destinyVersion: account.destinyVersion });
    }
  }

  function setActive(platform: DestinyAccount) {
    activePlatform$.next(platform);
    return current$.take(1).toPromise();
  }
}
